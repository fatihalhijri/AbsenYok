'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { ErrorState } from '@/components/shared/error-state';
import { useAuthStore } from '@/stores/auth-store';
import type { Role } from '@/types';
import { homePathFor, loginPathWithNext } from '../routing';
import { retryBootstrap } from './auth-bootstrap';
import { SplashScreen } from './splash-screen';

interface RoleGateProps {
  /** Role yang boleh membuka area ini. */
  allow: Role[];
  children: ReactNode;
}

/**
 * Penjaga area berbasis role (UX). Otorisasi sebenarnya tetap di backend.
 * - belum login → `/login?next=…`
 * - role tidak sesuai → beranda role tsb (`/admin` atau `/app`)
 */
export function RoleGate({ allow, children }: RoleGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const signedOut = useAuthStore((state) => state.signedOut);

  const allowed = status === 'authenticated' && role !== undefined && allow.includes(role);
  const search = searchParams.toString();

  useEffect(() => {
    if (status === 'unauthenticated' && !bootstrapError) {
      // Logout sendiri → /login polos; sesi habis/dicabut → kembali ke halaman ini setelah login.
      router.replace(
        signedOut ? '/login' : loginPathWithNext(`${pathname}${search ? `?${search}` : ''}`),
      );
    } else if (status === 'authenticated' && role && !allow.includes(role)) {
      router.replace(homePathFor(role));
    }
  }, [allow, bootstrapError, pathname, role, router, search, signedOut, status]);

  if (bootstrapError) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center">
        <ErrorState
          title="Server tidak dapat dihubungi"
          message="Periksa koneksi internet Anda, lalu coba lagi."
          onRetry={retryBootstrap}
        />
      </div>
    );
  }
  if (!allowed) {
    return <SplashScreen message={status === 'authenticated' ? 'Mengalihkan…' : undefined} />;
  }
  return children;
}
