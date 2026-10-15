import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';
import { env, getServerEnv } from './src/lib/env';

// Validasi env saat `next dev`/`next build` dimuat — konfigurasi salah langsung gagal dengan jelas.
// `env` (publik) juga dievaluasi di sini agar kesalahannya tidak baru muncul saat render.
void env;
const { BACKEND_INTERNAL_URL } = getServerEnv();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
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

export default withSerwist(nextConfig);
