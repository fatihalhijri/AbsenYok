'use client';

import { MapPinCheckIcon, QrCodeIcon, ShieldCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BrandMark } from '@/components/layout/brand-mark';
import { usePublicSettings } from '@/features/settings/hooks';
import { useAuthStore } from '@/stores/auth-store';
import type { UserProfile } from '@/types';
import { resolvePostLoginPath } from '../routing';
import { LoginForm } from './login-form';
import { SplashScreen } from './splash-screen';

const HIGHLIGHTS = [
  { icon: QrCodeIcon, text: 'QR Code dinamis berganti tiap 30 detik' },
  { icon: MapPinCheckIcon, text: 'Validasi lokasi kantor (geofence)' },
  { icon: ShieldCheckIcon, text: 'Satu akun terikat satu perangkat' },
];

/**
 * `?next=` dibaca langsung dari URL saat dibutuhkan (bukan `useSearchParams`) agar halaman login
 * bisa di-prerender utuh: form sudah ada di HTML statis → tampil (LCP) tanpa menunggu JavaScript.
 */
const readNext = () => new URLSearchParams(window.location.search).get('next');

export function LoginView() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  const { companyName } = usePublicSettings();

  const goHome = (user: Pick<UserProfile, 'role'>) =>
    router.replace(resolvePostLoginPath(readNext(), user.role));

  // Sesi berhasil dipulihkan (cookie masih valid) → langsung ke beranda/`next`.
  useEffect(() => {
    if (status === 'authenticated' && role) router.replace(resolvePostLoginPath(readNext(), role));
  }, [role, router, status]);

  // `idle` (prerender & sebelum bootstrap) → form langsung. Splash hanya saat sesi sungguh sedang
  // dipulihkan (ada penanda sesi) atau sudah pulih dan sedang dialihkan.
  if (status === 'loading' || status === 'authenticated') {
    return <SplashScreen message={status === 'authenticated' ? 'Mengalihkan…' : undefined} />;
  }

  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-2">
      <section
        aria-label="Tentang aplikasi"
        className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex"
      >
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 size-96 rounded-full bg-primary-foreground/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-teal-300/20 blur-3xl"
        />
        <BrandMark
          label="app"
          className="relative [&>span:first-child]:bg-primary-foreground [&>span:first-child]:text-primary"
        />
        <div className="relative max-w-md space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary-foreground">{companyName}</p>
            <h2 className="text-4xl leading-tight font-semibold text-balance">
              Absen cukup satu scan, langsung tercatat.
            </h2>
          </div>
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground">
          © {companyName} · Didukung AbsenYok
        </p>
      </section>

      <main className="flex items-center justify-center px-6 py-12 pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <BrandMark label="app" className="lg:hidden" />
            <h1 className="pt-4 text-2xl font-semibold tracking-tight lg:pt-0">Masuk</h1>
            <p className="text-sm text-muted-foreground">
              {/* Teks tetap (bukan nama instansi dari API): blok form tidak bergeser. */}
              Gunakan email dan password akun kantor Anda.
            </p>
          </div>
          <LoginForm onSuccess={goHome} />
          <p className="text-center text-xs text-muted-foreground">
            Lupa password? Hubungi admin untuk reset password.
          </p>
        </div>
      </main>
    </div>
  );
}
