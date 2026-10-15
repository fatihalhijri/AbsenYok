import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { Cache } from 'cache-manager';
import type { Response } from 'express';
import {
  AUTH_USER_CACHE_TTL_MS,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/auth.constants';
import { AuthCookieService } from '@/modules/auth/auth-cookie.service';
import { RefreshTokenCookie } from '@/modules/auth/decorators/refresh-token-cookie.decorator';
import { UserAuthCacheService } from '@/modules/auth/user-auth-cache.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { createConfigStub } from './auth-test-helpers';

function fakeResponse() {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

describe('AuthCookieService', () => {
  it('menyetel refresh token httpOnly (path auth) + penanda sesi dengan maxAge sisa masa berlaku', () => {
    const cookies = new AuthCookieService(
      createConfigStub({ COOKIE_SECURE: true, COOKIE_DOMAIN: 'absenyok.id' }),
    );
    const response = fakeResponse();
    const expiresAt = new Date(Date.now() + 60_000);

    cookies.setSessionCookies(response as unknown as Response, 'rt-value', expiresAt);

    const [name, value, options] = response.cookie.mock.calls[0] as [string, string, object];
    expect(name).toBe(REFRESH_COOKIE_NAME);
    expect(value).toBe('rt-value');
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      domain: 'absenyok.id',
      path: REFRESH_COOKIE_PATH,
    });
    const maxAge = (options as { maxAge: number }).maxAge;
    expect(maxAge).toBeGreaterThan(55_000);
    expect(maxAge).toBeLessThanOrEqual(60_000);
    expect(response.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      '1',
      expect.objectContaining({ path: '/', httpOnly: true }),
    );
  });

  it('maxAge tidak pernah negatif untuk token yang sudah lewat', () => {
    const response = fakeResponse();
    new AuthCookieService(createConfigStub()).setSessionCookies(
      response as unknown as Response,
      'rt',
      new Date(Date.now() - 1000),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'rt',
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('menghapus kedua cookie dengan path yang sama seperti saat disetel', () => {
    const response = fakeResponse();
    new AuthCookieService(createConfigStub()).clearSessionCookies(response as unknown as Response);
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: REFRESH_COOKIE_PATH, httpOnly: true }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      expect.objectContaining({ path: '/' }),
    );
  });
});

describe('UserAuthCacheService', () => {
  const user = { id: 'u1', email: 'a@absenyok.id', role: 'EMPLOYEE', isActive: true };

  function setup(cached: unknown = undefined, dbUser: unknown = user) {
    const cache = { get: jest.fn().mockResolvedValue(cached), set: jest.fn(), del: jest.fn() };
    const findFirst = jest.fn().mockResolvedValue(dbUser);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    return {
      service: new UserAuthCacheService(prisma, cache as unknown as Cache),
      cache,
      findFirst,
    };
  }

  it('cache hit → tidak query database', async () => {
    const { service, findFirst } = setup(user);
    await expect(service.get('u1')).resolves.toEqual(user);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('cache miss → query user yang belum dihapus lalu disimpan dengan TTL', async () => {
    const { service, cache, findFirst } = setup();
    await expect(service.get('u1')).resolves.toEqual(user);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1', deletedAt: null } }),
    );
    expect(cache.set).toHaveBeenCalledWith('auth:user:u1', user, AUTH_USER_CACHE_TTL_MS);
  });

  it('user tidak ada / dihapus → null dan tidak di-cache', async () => {
    const { service, cache } = setup(undefined, null);
    await expect(service.get('u1')).resolves.toBeNull();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('invalidate menghapus kunci cache user', async () => {
    const { service, cache } = setup();
    await service.invalidate('u1');
    expect(cache.del).toHaveBeenCalledWith('auth:user:u1');
  });
});

describe('@RefreshTokenCookie', () => {
  type Factory = (data: unknown, ctx: ExecutionContext) => string | undefined;

  function factory(): Factory {
    class Probe {
      handle(@RefreshTokenCookie() _token: string | undefined): void {}
    }
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handle') as Record<
      string,
      { factory: Factory }
    >;
    return Object.values(metadata)[0].factory;
  }

  const contextWith = (cookies: unknown) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ cookies }) }) }) as unknown as ExecutionContext;

  it.each([
    ['cookie ada', { [REFRESH_COOKIE_NAME]: 'token-123' }, 'token-123'],
    ['cookie kosong', { [REFRESH_COOKIE_NAME]: '' }, undefined],
    ['bukan string', { [REFRESH_COOKIE_NAME]: ['a'] }, undefined],
    ['cookie-parser tidak aktif', undefined, undefined],
  ])('%s', (_label, cookies, expected) => {
    expect(factory()(undefined, contextWith(cookies))).toBe(expected);
  });
});
