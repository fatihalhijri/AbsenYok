import { execSync } from 'node:child_process';
import { assertTestDatabaseUrl, loadTestEnv } from './test-db';

/**
 * Sekali sebelum seluruh e2e: kosongkan database test & terapkan semua migrasi
 * (`prisma migrate reset --force`; Prisma 7 tidak lagi menjalankan seed otomatis).
 * Pengaman: hanya berjalan pada database berakhiran `_test`.
 */
export default function globalSetup(): void {
  loadTestEnv();
  assertTestDatabaseUrl(process.env.DATABASE_URL);

  try {
    execSync('npx prisma migrate reset --force', { env: process.env, stdio: 'pipe' });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `Gagal menyiapkan database test. Pastikan MySQL menyala dan user database punya hak ` +
        `penuh atas "${new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)}".\n` +
        `${stderr?.toString() ?? ''}${stdout?.toString() ?? ''}`,
    );
  }
}
