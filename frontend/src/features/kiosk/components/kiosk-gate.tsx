'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { retryBootstrap } from '@/features/auth/components/auth-bootstrap';
import { SplashScreen } from '@/features/auth/components/splash-screen';
import { homePathFor } from '@/features/auth/routing';
import { useAuthStore } from '@/stores/auth-store';
import { backoffDelay } from '../schedule';
import { ConnectionOverlay, SessionEndedScreen } from './kiosk-status-screens';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN'];

/**
 * Penjaga layar kiosk (ADMIN/SUPER_ADMIN). Berbeda dengan RoleGate biasa, kiosk tak dijaga orang:
 * - server tak terjangkau saat memulihkan sesi → overlay koneksi + coba ulang otomatis (backoff);
 * - sesi ditolak → layar "Sesi kiosk berakhir" (tanpa berpindah diam-diam ke login);
 * - role karyawan → ke berandanya.
 */
export function KioskGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const [failures, setFailures] = useState(0);
  const [retryAt, setRetryAt] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && role && !ALLOWED.includes(role)) {
      router.replace(homePathFor(role));
    }
  }, [role, router, status]);

  // Pemulihan sesi gagal karena jaringan/server → coba lagi 2, 4, 8, 16, 30… dtk. Selama mencoba
  // (status `loading`) overlay tetap tampil agar layar tidak berkedip.
  useEffect(() => {
    if (status === 'authenticated') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset setelah pulih
      setFailures(0);
      return;
    }
    if (!bootstrapError) return;
    const attempt = failures + 1;
    const delay = backoffDelay(attempt);
    setRetryAt(Date.now() + delay);
    const retry = () => {
      setFailures(attempt);
      retryBootstrap();
    };
    const timer = setTimeout(retry, delay);
    window.addEventListener('online', retry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', retry);
    };
  }, [bootstrapError, failures, status]);

  const reconnecting = bootstrapError || (failures > 0 && status === 'loading');

  if (reconnecting) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <ConnectionOverlay retryAt={retryAt} className="max-w-2xl" />
      </div>
    );
  }
  if (status === 'unauthenticated') return <SessionEndedScreen nextPath={pathname} />;
  if (status !== 'authenticated' || !role || !ALLOWED.includes(role)) {
    return <SplashScreen message={status === 'authenticated' ? 'Mengalihkan…' : undefined} />;
  }
  return children;
}
