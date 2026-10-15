import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginView } from '@/features/auth/components/login-view';
import { SplashScreen } from '@/features/auth/components/splash-screen';

export const metadata: Metadata = { title: 'Masuk' };

export default function LoginPage() {
  return (
    // useSearchParams (`?next=`) wajib di dalam Suspense saat Cache Components aktif.
    <Suspense fallback={<SplashScreen />}>
      <LoginView />
    </Suspense>
  );
}
