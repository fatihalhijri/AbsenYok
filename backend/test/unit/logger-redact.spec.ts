import { Writable } from 'node:stream';
import pino, { type LoggerOptions } from 'pino';
import type { AppConfigService } from '@/config/app.config';
import {
  buildLoggerParams,
  isPinoPrettyInstalled,
  LOG_REDACT_CENSOR,
} from '@/config/logger.config';

/** Logger pino dengan opsi redact yang SAMA dengan aplikasi, keluaran ditampung di memori. */
function captureLogger() {
  const config = { isProduction: true, isTest: false } as AppConfigService;
  const options = buildLoggerParams(config).pinoHttp as LoggerOptions;
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const logger = pino({ level: 'info', redact: options.redact }, sink);
  return { logger, output: () => lines.join('') };
}

describe('Redaksi log (pino)', () => {
  it('produksi: level info, JSON tanpa pino-pretty', () => {
    const options = buildLoggerParams({
      isProduction: true,
      isTest: false,
    } as AppConfigService).pinoHttp as LoggerOptions;
    expect(options.level).toBe('info');
    expect(options.transport).toBeUndefined();
  });

  it('development: pino-pretty bila terpasang, JSON bila tidak (image Docker tanpa dev deps)', () => {
    const dev = { isProduction: false, isTest: false } as AppConfigService;
    const withPretty = buildLoggerParams(dev, () => true).pinoHttp as LoggerOptions;
    const withoutPretty = buildLoggerParams(dev, () => false).pinoHttp as LoggerOptions;
    expect(withPretty.transport).toMatchObject({ target: 'pino-pretty' });
    expect(withoutPretty.transport).toBeUndefined();
    expect(isPinoPrettyInstalled()).toBe(true);
  });

  it('header Authorization, Cookie & Set-Cookie disensor', () => {
    const { logger, output } = captureLogger();
    logger.info({
      req: { headers: { authorization: 'Bearer eyJhbGciOi.rahasia', cookie: 'ay_rt=rahasia-rt' } },
      res: { headers: { 'set-cookie': ['ay_rt=rahasia-baru; HttpOnly'] } },
    });
    expect(output()).not.toContain('rahasia');
    expect(output()).toContain(LOG_REDACT_CENSOR);
  });

  it.each([
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
  ])('field %s disensor di level atas maupun di dalam objek', (key) => {
    const { logger, output } = captureLogger();
    logger.info({ [key]: 'nilai-rahasia-1', body: { [key]: 'nilai-rahasia-2' } }, 'uji');
    expect(output()).not.toContain('nilai-rahasia');
    expect(output()).toContain('"msg":"uji"');
  });

  it('field biasa tidak ikut disensor', () => {
    const { logger, output } = captureLogger();
    logger.info({ body: { email: 'budi@absenyok.id' } });
    expect(output()).toContain('budi@absenyok.id');
  });
});
