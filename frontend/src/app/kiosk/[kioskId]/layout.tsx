import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { SplashScreen } from '@/features/auth/components/splash-screen';
import { KioskGate } from '@/features/kiosk/components/kiosk-gate';

export const metadata: Metadata = { title: 'Layar Kiosk' };

export const viewport: Viewport = { themeColor: '#09090b' };

/**
 * Layar kiosk: tanpa navigasi, khusus ADMIN/SUPER_ADMIN, mode gelap paksa (kontras tinggi di
 * layar besar) — QR sendiri tetap hitam di atas putih.
 */
export default function KioskLayout({ children }: LayoutProps<'/kiosk/[kioskId]'>) {
  return (
    <div className="dark min-h-dvh bg-background text-foreground [color-scheme:dark]">
      {/* usePathname/useParams (URL dinamis) wajib di dalam Suspense — Cache Components. */}
      <Suspense fallback={<SplashScreen />}>
        <KioskGate>{children}</KioskGate>
      </Suspense>
    </div>
  );
}
