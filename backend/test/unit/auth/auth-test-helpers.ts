import { JwtService } from '@nestjs/jwt';
import type { AppConfigService } from '@/config/app.config';
import type { Env } from '@/config/env.schema';
import { TokenService } from '@/modules/auth/token.service';

export const TEST_ENV: Partial<Env> = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  JWT_REFRESH_EXPIRES_IN: '7d',
  COOKIE_SECURE: false,
};

export function createConfigStub(overrides: Partial<Env> = {}): AppConfigService {
  const env = { ...TEST_ENV, ...overrides };
  return {
    get: <K extends keyof Env>(key: K) => env[key] as Env[K],
    isProduction: false,
    isTest: true,
  } as unknown as AppConfigService;
}

export function createTokenService(): { tokens: TokenService; jwt: JwtService } {
  const jwt = new JwtService({});
  return { tokens: new TokenService(jwt, createConfigStub()), jwt };
}
