import type { Metadata } from 'next';
import { LoginView } from '@/features/auth/components/login-view';

export const metadata: Metadata = { title: 'Masuk' };

export default function LoginPage() {
  // Tanpa useSearchParams → seluruh halaman (termasuk form) di-prerender statis.
  return <LoginView />;
}
