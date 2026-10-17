/** Env yang boleh dibaca browser (diawali NEXT_PUBLIC_, di-inline saat build). */
export interface ClientEnv {
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_APP_TIMEZONE: string;
  NEXT_PUBLIC_API_BASE: string;
  /** Diisi otomatis dari package.json oleh next.config.ts. */
  NEXT_PUBLIC_APP_VERSION: string;
}

/**
 * Env publik. Divalidasi Zod sekali saat `next dev`/`next build` (`env.server.ts`, dipanggil
 * next.config.ts) — konfigurasi salah menggagalkan build, jadi di sini cukup nilai + default yang
 * sama tanpa memuat Zod ke bundle browser. Setiap variabel ditulis lengkap
 * (`process.env.NEXT_PUBLIC_…`) karena Next.js hanya meng-inline referensi statis.
 */
export const env: ClientEnv = {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'AbsenYok',
  NEXT_PUBLIC_APP_TIMEZONE: process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Jakarta',
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || '/api/v1',
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
};
