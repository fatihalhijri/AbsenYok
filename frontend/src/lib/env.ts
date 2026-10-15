import { z } from 'zod';

const isValidTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** Env yang boleh dibaca browser (diawali NEXT_PUBLIC_, di-inline saat build). */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1, 'wajib diisi').default('AbsenYok'),
  NEXT_PUBLIC_APP_TIMEZONE: z
    .string()
    .default('Asia/Jakarta')
    .refine(isValidTimeZone, 'zona waktu IANA tidak dikenal (mis. Asia/Jakarta)'),
  NEXT_PUBLIC_API_BASE: z
    .string()
    .default('/api/v1')
    .refine((value) => value.startsWith('/'), 'harus path relatif (mis. /api/v1) agar lewat proxy'),
});

/** Env khusus server Next.js (tidak pernah dikirim ke browser). */
const serverSchema = z.object({
  BACKEND_INTERNAL_URL: z
    .url({ protocol: /^https?$/, error: 'harus URL http(s), mis. http://localhost:4000' })
    .transform((value) => value.replace(/\/+$/, '')),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues.map(
    (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
  );
  throw new Error(
    ['Konfigurasi environment frontend tidak valid (lihat .env.example):', ...issues].join('\n'),
  );
}

/**
 * Env publik. Setiap variabel ditulis lengkap (`process.env.NEXT_PUBLIC_…`) karena Next.js
 * hanya meng-inline referensi statis ke bundle browser.
 */
export const env: ClientEnv = parse(clientSchema, {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_TIMEZONE: process.env.NEXT_PUBLIC_APP_TIMEZONE,
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
});

/** Env server; dipanggil dari next.config.ts sehingga env salah langsung gagal saat dev/build. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() hanya boleh dipanggil di server');
  }
  return parse(serverSchema, { BACKEND_INTERNAL_URL: process.env.BACKEND_INTERNAL_URL });
}
