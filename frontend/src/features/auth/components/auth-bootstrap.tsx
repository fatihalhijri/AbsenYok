'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/error';
import { useAuthStore } from '@/stores/auth-store';
import { loginPathWithNext } from '../routing';

/**
 * Saat aplikasi dimuat: pulihkan sesi diam-diam lewat `/auth/refresh` (cookie httpOnly).
 * Juga mendaftarkan redirect berbasis router saat refresh di tengah pemakaian gagal.
 */
export function AuthBootstrap() {
  const router = useRouter();

  useEffect(() => {
    api.setSessionExpiredHandler((nextPath) => {
      // Layar kiosk tak dijaga orang: tampilkan "Sesi kiosk berakhir" (KioskGate), bukan
      // berpindah diam-diam ke halaman login.
      if (nextPath === '/kiosk' || nextPath?.startsWith('/kiosk/')) return;
      router.replace(loginPathWithNext(nextPath));
    });
  }, [router]);

  useEffect(() => {
    const { status, setStatus } = useAuthStore.getState();
    // Hanya sekali per muat halaman (StrictMode memanggil effect dua kali; refresh juga single-flight).
    if (status !== 'idle') return;
    setStatus('loading');
    api.refreshSession().catch(markBootstrapFailure);
  }, []);

  return null;
}

/**
 * Refresh ditolak (401/403) → belum login. Gangguan jaringan/server (offline, 5xx dari proxy saat
 * backend mati) → tampilkan "coba lagi", jangan lempar user ke halaman login.
 */
function markBootstrapFailure(error: unknown) {
  useAuthStore
    .getState()
    .setStatus('unauthenticated', { bootstrapError: !toApiError(error).isAuthRejection });
}

/** Ulangi bootstrap (tombol "coba lagi" saat server tidak terjangkau). */
export function retryBootstrap() {
  const { setStatus } = useAuthStore.getState();
  setStatus('loading');
  api.refreshSession().catch(markBootstrapFailure);
}
