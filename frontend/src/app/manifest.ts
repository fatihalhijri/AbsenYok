import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app',
    name: 'AbsenYok',
    short_name: 'AbsenYok',
    description: 'Absensi karyawan dengan QR Code dinamis, lokasi, dan perangkat terdaftar.',
    lang: 'id',
    dir: 'ltr',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: BRAND.themeColor,
    background_color: BRAND.backgroundColor,
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Scan Absen',
        short_name: 'Scan',
        description: 'Buka pemindai QR untuk absen masuk/pulang',
        url: '/app/scan',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
