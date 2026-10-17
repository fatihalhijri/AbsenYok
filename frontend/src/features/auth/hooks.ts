'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { attendanceApi, attendanceKeys } from '@/features/attendance/api';
import { todayString } from '@/lib/date';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from './api';
import type { ChangePasswordInput, LoginInput } from './schemas';

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: ({ accessToken, user }) => {
      setSession({ accessToken, user });
      // Karyawan langsung ke beranda: mulai ambil datanya paralel dengan navigasi (tanpa menunggu
      // halaman beranda dimuat). Kegagalan diabaikan — beranda mengambil ulang sendiri.
      if (user.role === 'EMPLOYEE') {
        void queryClient.prefetchQuery({
          queryKey: attendanceKeys.today(),
          queryFn: attendanceApi.myToday,
        });
        const month = todayString().slice(0, 7);
        void queryClient.prefetchQuery({
          queryKey: attendanceKeys.month(month),
          queryFn: () => attendanceApi.myMonth(month),
        });
      }
    },
  });
}

/**
 * Hapus sesi lokal: cache query, store, lalu ke halaman login. Dipakai logout & setelah
 * ganti password (backend mencabut semua sesi).
 */
export function useEndSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clear = useAuthStore((state) => state.clear);
  return useCallback(
    (loginPath = '/login') => {
      queryClient.clear();
      clear({ signedOut: true });
      router.replace(loginPath);
    },
    [clear, queryClient, router],
  );
}

/** Logout: cabut refresh token di server, lalu bersihkan sesi lokal (walau API gagal). */
export function useLogout() {
  const endSession = useEndSession();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => endSession(),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: ChangePasswordInput) => authApi.changePassword(input) });
}
