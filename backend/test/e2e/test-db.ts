import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';

const TEST_DB_SUFFIX = '_test';

/** `mysql://…/absenyok` → `mysql://…/absenyok_test` (tidak berubah bila sudah berakhiran _test). */
export function toTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name.endsWith(TEST_DB_SUFFIX)) url.pathname = `/${name}${TEST_DB_SUFFIX}`;
  return url.toString();
}

/** Pengaman: operasi penghapusan data e2e hanya boleh pada database berakhiran `_test`. */
export function assertTestDatabaseUrl(databaseUrl: string | undefined): void {
  const name = databaseUrl ? new URL(databaseUrl).pathname.replace(/^\//, '') : '';
  if (!name.endsWith(TEST_DB_SUFFIX)) {
    throw new Error(`Menolak menjalankan e2e pada database "${name}" (harus berakhiran _test)`);
  }
}

/** Muat env (.env lalu .env.example), arahkan DATABASE_URL ke database test & UPLOAD_DIR ke temp. */
export function loadTestEnv(): void {
  process.env.NODE_ENV = 'test';
  config({ path: ['.env', '.env.example'], quiet: true });
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = toTestDatabaseUrl(process.env.DATABASE_URL);
  }
  // File upload e2e ke folder temp agar tidak mengotori ./uploads.
  process.env.UPLOAD_DIR = join(tmpdir(), 'absenyok-e2e-uploads');
}
