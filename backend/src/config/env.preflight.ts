/**
 * WAJIB di-import paling awal di main.ts.
 * Memvalidasi env sebelum modul Nest dievaluasi (ConfigModule memvalidasi saat import),
 * sehingga konfigurasi salah menghasilkan pesan jelas tanpa stack trace lalu exit(1).
 */
import { config } from 'dotenv';
import { EnvValidationError, validateEnv } from './env.schema';

config({ quiet: true });

try {
  validateEnv(process.env);
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(`\n❌ ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
