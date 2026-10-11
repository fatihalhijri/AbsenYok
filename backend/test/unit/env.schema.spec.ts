import { EnvValidationError, validateEnv } from '@/config/env.schema';

const baseEnv = (): Record<string, string> => ({
  NODE_ENV: 'development',
  PORT: '4000',
  APP_NAME: 'AbsenYok',
  APP_TIMEZONE: 'Asia/Jakarta',
  CORS_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'mysql://absenyok:absenyok_secret@localhost:3306/absenyok',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  JWT_REFRESH_EXPIRES_IN: '7d',
  COOKIE_SECURE: 'false',
  COOKIE_DOMAIN: '',
  QR_SIGNING_SECRET: 'c'.repeat(64),
  QR_KIOSK_INTERVAL_SECONDS: '30',
  QR_PERSONAL_INTERVAL_SECONDS: '60',
  GEOFENCE_ENABLED: 'true',
  GEOFENCE_MAX_ACCURACY_METERS: '100',
  DEVICE_BINDING_ENABLED: 'true',
  MIN_CHECKOUT_GAP_MINUTES: '5',
  THROTTLE_TTL_MS: '60000',
  THROTTLE_LIMIT: '120',
  UPLOAD_DIR: './uploads',
  MAX_UPLOAD_SIZE_MB: '2',
  SEED_DEFAULT_PASSWORD: 'Admin@12345',
});

const issuesOf = (env: Record<string, string | undefined>): string[] => {
  try {
    validateEnv(env);
  } catch (error) {
    if (error instanceof EnvValidationError) return error.issues;
    throw error;
  }
  throw new Error('validateEnv seharusnya gagal');
};

describe('env.schema validateEnv()', () => {
  it('menerima env lengkap dan mengonversi tipe', () => {
    const env = validateEnv(baseEnv());

    expect(env.PORT).toBe(4000);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.GEOFENCE_ENABLED).toBe(true);
    expect(env.COOKIE_DOMAIN).toBeUndefined();
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3000']);
    expect(env.THROTTLE_TTL_MS).toBe(60_000);
  });

  it('boolean "false"/"0" tidak dianggap true', () => {
    const env = validateEnv({
      ...baseEnv(),
      GEOFENCE_ENABLED: 'false',
      DEVICE_BINDING_ENABLED: '0',
    });
    expect(env.GEOFENCE_ENABLED).toBe(false);
    expect(env.DEVICE_BINDING_ENABLED).toBe(false);
  });

  it('memakai nilai default untuk variabel opsional', () => {
    const env = validateEnv({
      CORS_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: 'mysql://u:p@localhost:3306/db',
      JWT_ACCESS_SECRET: 'a'.repeat(64),
      JWT_REFRESH_SECRET: 'b'.repeat(64),
      QR_SIGNING_SECRET: 'c'.repeat(64),
    });

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      APP_TIMEZONE: 'Asia/Jakarta',
      JWT_ACCESS_EXPIRES_IN: '15m',
      QR_KIOSK_INTERVAL_SECONDS: 30,
      GEOFENCE_ENABLED: true,
      MIN_CHECKOUT_GAP_MINUTES: 5,
      MAX_UPLOAD_SIZE_MB: 2,
    });
  });

  it('memecah CORS_ORIGIN yang dipisah koma', () => {
    const env = validateEnv({
      ...baseEnv(),
      CORS_ORIGIN: 'http://localhost:3000, https://absen.example.com',
    });
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3000', 'https://absen.example.com']);
  });

  it.each([
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'QR_SIGNING_SECRET',
    'CORS_ORIGIN',
  ])('gagal dengan pesan jelas bila %s tidak ada', (key) => {
    const env: Record<string, string | undefined> = baseEnv();
    delete env[key];
    expect(issuesOf(env)).toContainEqual(expect.stringContaining(`${key}:`));
  });

  it('pesan error menyebut file .env dan setiap variabel bermasalah', () => {
    const env: Record<string, string | undefined> = { ...baseEnv(), PORT: 'abc' };
    delete env.JWT_ACCESS_SECRET;

    expect(() => validateEnv(env)).toThrow(/Konfigurasi environment tidak valid/);
    expect(issuesOf(env)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('PORT:'),
        expect.stringContaining('JWT_ACCESS_SECRET:'),
      ]),
    );
  });

  it.each([
    ['APP_TIMEZONE', 'Mars/Olympus'],
    ['GEOFENCE_ENABLED', 'ya'],
    ['JWT_ACCESS_EXPIRES_IN', '15 menit'],
    ['DATABASE_URL', 'postgres://u:p@localhost/db'],
    ['CORS_ORIGIN', 'bukan-url'],
    ['JWT_ACCESS_SECRET', 'pendek'],
    ['NODE_ENV', 'staging'],
  ])('menolak %s = "%s"', (key, value) => {
    expect(issuesOf({ ...baseEnv(), [key]: value })).toContainEqual(
      expect.stringContaining(`${key}:`),
    );
  });

  it('menolak JWT access & refresh secret yang sama', () => {
    expect(issuesOf({ ...baseEnv(), JWT_REFRESH_SECRET: 'a'.repeat(64) })).toContainEqual(
      expect.stringContaining('JWT_REFRESH_SECRET:'),
    );
  });

  it('di produksi menolak secret contoh dari .env.example', () => {
    const issues = issuesOf({
      ...baseEnv(),
      NODE_ENV: 'production',
      QR_SIGNING_SECRET: 'ganti_dengan_string_acak_64_byte_lain',
    });
    expect(issues).toContainEqual(expect.stringContaining('QR_SIGNING_SECRET:'));
  });
});
