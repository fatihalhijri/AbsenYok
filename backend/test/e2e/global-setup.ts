import { execSync } from 'node:child_process';
import { assertTestDatabaseUrl, loadTestEnv } from './test-db';

/** Sekali sebelum seluruh e2e: terapkan migrasi ke database test (tidak menghapus data). */
export default function globalSetup(): void {
  loadTestEnv();
  assertTestDatabaseUrl(process.env.DATABASE_URL);

  try {
    execSync('npx prisma migrate deploy', { env: process.env, stdio: 'pipe' });
  } catch (error) {
    const output = (error as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(
      `Gagal menyiapkan database test. Pastikan MySQL menyala dan database ` +
        `"${new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)}" sudah dibuat.\n${output}`,
    );
  }
}
