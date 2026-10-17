import type { NextConfig } from 'next';
import packageJson from './package.json';
import { env, getServerEnv } from './src/lib/env';

// Validasi env saat `next dev`/`next build` dimuat — konfigurasi salah langsung gagal dengan jelas.
// `env` (publik) juga dievaluasi di sini agar kesalahannya tidak baru muncul saat render.
void env;
const { BACKEND_INTERNAL_URL } = getServerEnv();
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy. `script-src 'unsafe-inline'` diperlukan untuk skrip inline Next.js
 * (bootstrap & payload RSC): CSP berbasis nonce memaksa setiap halaman dirender dinamis sehingga
 * prerender/PPR Cache Components hilang. Mitigasi XSS utama: React meng-escape semua data dan
 * tidak ada HTML mentah dari server. `wasm-unsafe-eval` untuk dekoder QR ZXing (WebAssembly);
 * `unsafe-eval` & websocket hanya di dev (HMR/React Refresh).
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Tile peta OpenStreetMap, avatar (via optimizer), QR/lampiran lokal (data:/blob:).
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  // Stream kamera dipasang lewat srcObject; blob: untuk media lokal.
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  // Kamera & lokasi hanya untuk origin sendiri; wake lock & fullscreen dipakai layar kiosk/QR.
  {
    key: 'Permissions-Policy',
    value:
      'camera=(self), geolocation=(self), screen-wake-lock=(self), fullscreen=(self), microphone=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Diabaikan browser bila diakses lewat HTTP (mis. localhost); berlaku di balik HTTPS produksi.
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Area /app, /admin, /kiosk dirender setelah sesi diverifikasi di browser (token hanya di
    // memori, RoleGate) sehingga validasi instant-navigation otomatis tidak bisa merender
    // halamannya di server dan memunculkan error dev di setiap halaman. Validasi hanya untuk
    // segmen yang menyatakan `export const instant` secara eksplisit.
    instantInsights: { validationLevel: 'manual-warning' },
  },
  poweredByHeader: false,
  // Server mandiri untuk image Docker (`.next/standalone`, lihat Dockerfile).
  output: 'standalone',
  images: {
    // Avatar dari backend (`/uploads/avatars/*.webp`, lewat rewrite di bawah) dioptimasi next/image.
    localPatterns: [{ pathname: '/uploads/avatars/**' }],
    formats: ['image/avif', 'image/webp'],
  },
  // Versi aplikasi untuk menu Profil → Tentang (di-inline ke bundle browser).
  env: { NEXT_PUBLIC_APP_VERSION: packageJson.version },
  allowedDevOrigins: ['192.168.1.8'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  /** Beranda publik belum ada: `/` → `/login` di level routing (sebelum render). */
  async redirects() {
    return [{ source: '/', destination: '/login', permanent: false }];
  },
  /**
   * Proxy ke backend: browser cukup memanggil `/api/v1/...` & `/uploads/...` di origin yang
   * sama (cookie refresh token httpOnly tetap first-party, tanpa CORS).
   * Catatan: tujuan rewrite ditetapkan saat build — BACKEND_INTERNAL_URL harus benar saat build.
   */
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_INTERNAL_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_INTERNAL_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
