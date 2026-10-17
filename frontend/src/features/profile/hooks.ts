'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { qrRefreshDelay as scheduleDelay, type TimedQr } from '@/lib/qr-schedule';
import { useAuthStore } from '@/stores/auth-store';
import { profileApi, profileKeys } from './api';

/** Ambil token baru sekian ms sebelum `expiresAt` agar QR di layar tidak pernah kedaluwarsa. */
export const QR_REFRESH_LEAD_MS = 3_000;

/** Jadwal refresh QR personal (lihat `lib/qr-schedule.ts`). */
export const qrRefreshDelay = (qr: TimedQr, receivedAt: number, now: number) =>
  scheduleDelay(qr, receivedAt, now, { leadMs: QR_REFRESH_LEAD_MS });

/**
 * QR personal yang memperbarui diri. `placeholderData` mempertahankan token lama selama token
 * baru dimuat → QR berganti dalam satu render, tanpa kedip/skeleton.
 */
export function useMyQr() {
  const query = useQuery({
    queryKey: profileKeys.qr(),
    queryFn: profileApi.myQr,
    placeholderData: (previous) => previous,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const data = q.state.data;
      return data ? qrRefreshDelay(data, q.state.dataUpdatedAt, Date.now()) : false;
    },
    refetchIntervalInBackground: false,
  });
  const offsetMs = query.data ? Date.parse(query.data.serverTime) - query.dataUpdatedAt : 0;
  return { ...query, offsetMs };
}

export function useUpdateMe() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({ mutationFn: profileApi.updateMe, onSuccess: setUser });
}

export function useUploadAvatar(onProgress?: (percent: number) => void) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file, onProgress),
    onSuccess: ({ avatarUrl }) => {
      if (user) setUser({ ...user, avatarUrl });
    },
  });
}
