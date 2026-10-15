'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from './api';
import type { ChangePasswordInput, LoginInput } from './schemas';

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: ({ accessToken, user }) => setSession({ accessToken, user }),
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
