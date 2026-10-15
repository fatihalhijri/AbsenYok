import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import { Providers } from './providers';
import './globals.css';

const fontSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const fontMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

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
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
