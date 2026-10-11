import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/** Subset `mariadb.PoolConfig` yang dipakai AbsenYok. */
export interface MariaDbPoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** Sesi MySQL dikunci ke UTC agar `CURRENT_TIMESTAMP`/`NOW()` konsisten dengan data aplikasi. */
  timezone: 'Z';
  connectionLimit: number;
  connectTimeout: number;
  acquireTimeout: number;
  allowPublicKeyRetrieval: boolean;
}

export interface DatabaseUrlOptions {
  /** Default `allowPublicKeyRetrieval` bila tidak ditentukan lewat query string URL. */
  allowPublicKeyRetrievalByDefault: boolean;
}

const DEFAULT_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000;

function positiveIntParam(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Parameter DATABASE_URL "${key}" harus bilangan bulat positif`);
  }
  return value;
}

/**
 * `mysql://user:pass@host:3306/db?connection_limit=10` → config pool driver mariadb.
 *
 * Query string yang didukung: `connection_limit`, `connect_timeout` (ms),
 * `pool_timeout` (ms), `allowPublicKeyRetrieval` (`true`/`false`).
 */
export function parseDatabaseUrl(
  databaseUrl: string,
  { allowPublicKeyRetrievalByDefault }: DatabaseUrlOptions,
): MariaDbPoolConfig {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:' && url.protocol !== 'mariadb:') {
    throw new Error('DATABASE_URL harus memakai skema mysql://');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) {
    throw new Error('DATABASE_URL harus menyertakan nama database (mysql://.../nama_db)');
  }

  const params = url.searchParams;
  const publicKeyParam = params.get('allowPublicKeyRetrieval');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : DEFAULT_PORT,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    timezone: 'Z',
    connectionLimit: positiveIntParam(params, 'connection_limit', DEFAULT_CONNECTION_LIMIT),
    connectTimeout: positiveIntParam(params, 'connect_timeout', DEFAULT_CONNECT_TIMEOUT_MS),
    acquireTimeout: positiveIntParam(params, 'pool_timeout', DEFAULT_ACQUIRE_TIMEOUT_MS),
    allowPublicKeyRetrieval:
      publicKeyParam === null ? allowPublicKeyRetrievalByDefault : publicKeyParam === 'true',
  };
}

/**
 * Driver adapter Prisma untuk MySQL 8 (via driver mariadb). Dipakai PrismaService & seed.
 * `allowPublicKeyRetrieval` dibutuhkan MySQL 8 (`caching_sha2_password`) tanpa TLS; di produksi
 * default-nya mati dan harus diaktifkan eksplisit lewat URL bila memang diperlukan.
 */
export function createPrismaAdapter(databaseUrl: string, isProduction: boolean): PrismaMariaDb {
  const config = parseDatabaseUrl(databaseUrl, {
    allowPublicKeyRetrievalByDefault: !isProduction,
  });
  return new PrismaMariaDb(config, { database: config.database });
}
