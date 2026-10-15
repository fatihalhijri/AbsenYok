import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import { Providers } from './providers';
import './globals.css';

const fontSans = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  applicationName: env.NEXT_PUBLIC_APP_NAME,
  title: { default: env.NEXT_PUBLIC_APP_NAME, template: `%s · ${env.NEXT_PUBLIC_APP_NAME}` },
  description: 'Absensi karyawan dengan QR Code dinamis, lokasi, dan perangkat terdaftar.',
  // Meta apple-mobile-web-app-capable & ikon home screen iOS.
  appleWebApp: {
    capable: true,
    title: env.NEXT_PUBLIC_APP_NAME,
    statusBarStyle: 'default',
  },
  icons: { apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
  // Next 16 hanya menulis `mobile-web-app-capable`; iOS Safari lama masih membaca versi apple-.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BRAND.themeColor },
    { media: '(prefers-color-scheme: dark)', color: BRAND.themeColorDark },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="id"
      dir="ltr"
      className={`${fontSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
