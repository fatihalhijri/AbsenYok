'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { profileApi, profileKeys } from './api';

/** Ambil token baru sekian ms sebelum `expiresAt` agar QR di layar tidak pernah kedaluwarsa. */
export const QR_REFRESH_LEAD_MS = 3_000;
/** Jeda setelah jendela berganti sebelum meminta token jendela berikutnya. */
export const QR_ROLLOVER_MS = 300;
/** Jeda minimum antar-refresh (melindungi dari jam/expiresAt yang aneh). */
const MIN_REFRESH_MS = 250;

/**
 * Jadwal refresh QR personal (jeda ms dari "sekarang" menurut jam perangkat), dikoreksi selisih
 * jam server−perangkat dari `serverTime` sehingga tepat walau jam HP meleset:
 * - normalnya `expiresAt − 3 dtk`;
 * - bila token baru diterima di 3 dtk terakhir (server masih di jendela yang sama sehingga token
 *   belum berganti), refresh berikutnya tepat setelah jendela berganti (`expiresAt + 300 ms`).
 * Backend menerima token jendela sebelumnya, jadi token lama tetap sah selama pergantian.
 */
export function qrRefreshDelay(
  qr: { expiresAt: string; serverTime: string },
  receivedAt: number,
  now: number,
): number {
  const offset = Date.parse(qr.serverTime) - receivedAt; // jam server − jam perangkat
  const expiresAtDevice = Date.parse(qr.expiresAt) - offset;
  const leadAt = expiresAtDevice - QR_REFRESH_LEAD_MS;
  const target = receivedAt < leadAt ? leadAt : expiresAtDevice + QR_ROLLOVER_MS;
  return Math.max(MIN_REFRESH_MS, target - now);
}

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
