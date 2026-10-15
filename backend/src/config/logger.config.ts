import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppConfigService } from './app.config';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

/** Nama field rahasia — disensor di level atas maupun satu tingkat di dalam objek log. */
const SECRET_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  'qrToken',
  'tokenHash',
  'secret',
];

/** Data sensitif yang tidak boleh muncul di log. */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SECRET_KEYS.flatMap((key) => [key, `*.${key}`]),
];

export const LOG_REDACT_CENSOR = '[REDACTED]';

function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/**
 * `pino-pretty` hanya devDependency: image Docker (tanpa dependensi dev) yang dijalankan dengan
 * NODE_ENV=development harus tetap bisa start dengan log JSON.
 */
export function isPinoPrettyInstalled(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

/** Konfigurasi nestjs-pino: pretty di development (bila tersedia), JSON di produksi, senyap saat test. */
export function buildLoggerParams(
  config: AppConfigService,
  prettyInstalled: () => boolean = isPinoPrettyInstalled,
): Params {
  const pretty = !config.isProduction && !config.isTest && prettyInstalled();

  return {
    pinoHttp: {
      level: config.isTest ? 'silent' : config.isProduction ? 'info' : 'debug',
      transport: pretty
        ? {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      redact: { paths: LOG_REDACT_PATHS, censor: LOG_REDACT_CENSOR },
      genReqId: requestId,
      // Log ringkas: header lengkap tidak dicatat (redact tetap aktif sebagai lapisan kedua).
      serializers: {
        req: (req: { id: unknown; method: string; url: string; remoteAddress?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/api/v1/health',
      },
    },
  };
}
