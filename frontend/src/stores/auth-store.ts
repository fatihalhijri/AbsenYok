import { create, type StateCreator } from 'zustand';
import type { UserProfile } from '@/types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthSession {
  accessToken: string;
  user: UserProfile;
}

export interface AuthState {
  /** Access token HANYA di memori (tidak di localStorage/sessionStorage). */
  accessToken: string | null;
  user: UserProfile | null;
  status: AuthStatus;
  /**
   * Bootstrap sesi gagal karena server tidak terjangkau (bukan karena belum login) —
   * UI menampilkan "coba lagi" alih-alih melempar user ke halaman login.
   */
  bootstrapError: boolean;
  /** Sesi diakhiri user sendiri (logout/ganti password) → ke /login tanpa `next`. */
  signedOut: boolean;
  setSession: (session: AuthSession) => void;
  setUser: (user: UserProfile) => void;
  setStatus: (status: AuthStatus, options?: { bootstrapError?: boolean }) => void;
  clear: (options?: { signedOut?: boolean }) => void;
}

const authStateCreator: StateCreator<AuthState> = (set) => ({
  accessToken: null,
  user: null,
  status: 'idle',
  bootstrapError: false,
  signedOut: false,
  setSession: ({ accessToken, user }) =>
    set({ accessToken, user, status: 'authenticated', bootstrapError: false, signedOut: false }),
  setUser: (user) => set({ user }),
  setStatus: (status, options) => set({ status, bootstrapError: options?.bootstrapError ?? false }),
  clear: (options) =>
    set({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
      bootstrapError: false,
      signedOut: options?.signedOut ?? false,
    }),
});

/** Store baru (dipakai test agar tiap kasus terisolasi). */
export const createAuthStore = () => create<AuthState>()(authStateCreator);

/** Sesi login aplikasi — sengaja TIDAK di-persist. */
export const useAuthStore = createAuthStore();

export type AuthStore = typeof useAuthStore;
