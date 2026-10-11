import { z } from 'zod';

const PLACEHOLDER_SECRET_PREFIX = 'ganti_dengan';
const DURATION_REGEX = /^\d+[smhd]$/;

/** String kosong ("KEY=") diperlakukan sama dengan variabel tidak diisi. */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** `z.coerce.boolean()` mengubah "false" menjadi true, jadi parsing dilakukan eksplisit. */
const booleanFromString = (defaultValue: boolean) =>
  z.preprocess(
    emptyToUndefined,
    z
      .enum(['true', 'false', '1', '0'], { error: 'harus bernilai true atau false' })
      .default(defaultValue ? 'true' : 'false')
      .transform((value) => value === 'true' || value === '1'),
  );

const positiveInt = (defaultValue: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: 'harus berupa angka' })
      .int('harus berupa bilangan bulat')
      .positive('harus lebih besar dari 0')
      .default(defaultValue),
  );

const requiredString = (minLength = 1) =>
  z.preprocess(
    emptyToUndefined,
    z.string({ error: 'wajib diisi' }).min(minLength, `minimal ${minLength} karakter`),
  );

const secret = () => requiredString(32);

const duration = (defaultValue: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(DURATION_REGEX, 'format durasi tidak valid (contoh: 15m, 7d)')
      .default(defaultValue),
  );

const isValidTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

export const envSchema = z
  .object({
    // APP
    NODE_ENV: z.preprocess(
      emptyToUndefined,
      z.enum(['development', 'production', 'test']).default('development'),
    ),
    PORT: positiveInt(4000),
    APP_NAME: z.preprocess(emptyToUndefined, z.string().default('AbsenYok')),
    APP_TIMEZONE: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .default('Asia/Jakarta')
        .refine(isValidTimezone, 'zona waktu IANA tidak valid (contoh: Asia/Jakarta)'),
    ),
    CORS_ORIGIN: requiredString().transform((value, ctx) => {
      const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
      for (const origin of origins) {
        if (!URL.canParse(origin)) {
          ctx.addIssue({ code: 'custom', message: `origin "${origin}" bukan URL yang valid` });
        }
      }
      return origins;
    }),

    // DATABASE
    DATABASE_URL: requiredString().refine(
      (value) => /^mysql:\/\/.+/.test(value) && URL.canParse(value),
      'harus berupa URL MySQL (mysql://user:password@host:port/database)',
    ),

    // JWT
    JWT_ACCESS_SECRET: secret(),
    JWT_ACCESS_EXPIRES_IN: duration('15m'),
    JWT_REFRESH_SECRET: secret(),
    JWT_REFRESH_EXPIRES_IN: duration('7d'),

    // COOKIE
    COOKIE_SECURE: booleanFromString(false),
    COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),

    // QR
    QR_SIGNING_SECRET: secret(),
    QR_KIOSK_INTERVAL_SECONDS: positiveInt(30),
    QR_PERSONAL_INTERVAL_SECONDS: positiveInt(60),

    // VALIDASI ABSENSI
    GEOFENCE_ENABLED: booleanFromString(true),
    GEOFENCE_MAX_ACCURACY_METERS: positiveInt(100),
    DEVICE_BINDING_ENABLED: booleanFromString(true),
    MIN_CHECKOUT_GAP_MINUTES: positiveInt(5),

    // RATE LIMIT
    THROTTLE_TTL_MS: positiveInt(60_000),
    THROTTLE_LIMIT: positiveInt(120),

    // UPLOAD
    UPLOAD_DIR: z.preprocess(emptyToUndefined, z.string().default('./uploads')),
    MAX_UPLOAD_SIZE_MB: positiveInt(2),

    // SEED (hanya dipakai skrip seed)
    SEED_DEFAULT_PASSWORD: z.preprocess(
      emptyToUndefined,
      z.string().min(8, 'minimal 8 karakter').optional(),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'harus berbeda dari JWT_ACCESS_SECRET',
      });
    }

    if (env.NODE_ENV !== 'production') return;

    const secretKeys = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'QR_SIGNING_SECRET'] as const;
    for (const key of secretKeys) {
      if (env[key].startsWith(PLACEHOLDER_SECRET_PREFIX)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'masih memakai nilai contoh dari .env.example; ganti dengan string acak',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      [
        'Konfigurasi environment tidak valid. Periksa file .env (lihat .env.example):',
        ...issues.map((issue) => `  - ${issue}`),
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

/** Dipakai oleh `ConfigModule.forRoot({ validate })`; melempar error bila env tidak valid. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const key = issue.path.join('.') || '(root)';
    return `${key}: ${issue.message}`;
  });
  throw new EnvValidationError(issues);
}
