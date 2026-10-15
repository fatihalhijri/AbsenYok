import { create } from 'zustand';
import type { UserProfile } from '@/types';

interface AuthState {
  /** Access token disimpan di memori saja (tidak di localStorage) — lihat FE-03. */
  accessToken: string | null;
  user: UserProfile | null;
  setSession: (session: { accessToken: string; user: UserProfile }) => void;
  setUser: (user: UserProfile) => void;
  clear: () => void;
}

/** Sesi login. Login, refresh otomatis, dan proteksi route ditambahkan di FE-03. */
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null }),
}));
