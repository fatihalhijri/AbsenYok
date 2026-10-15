import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { RoleGate } from '@/features/auth/components/role-gate';
import { SplashScreen } from '@/features/auth/components/splash-screen';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin AbsenYok' },
};

/** Layout admin (desktop-first), khusus SUPER_ADMIN & ADMIN: sidebar + topbar. */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<SplashScreen />}>
      <RoleGate allow={['SUPER_ADMIN', 'ADMIN']}>
        <AdminShell>{children}</AdminShell>
      </RoleGate>
    </Suspense>
  );
}
