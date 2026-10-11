import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AuthUser } from '@/common/types/auth-user.type';
import type { UserAuthCacheService } from '@/modules/auth/user-auth-cache.service';
import { createTokenService } from './auth-test-helpers';

type TestRequest = { headers: Record<string, string>; user?: AuthUser };

function createContext(request: TestRequest, metadata: Record<string, unknown> = {}) {
  const handler = () => undefined;
  class TestController {}
  for (const [key, value] of Object.entries(metadata)) {
    Reflect.defineMetadata(key, value, handler);
  }
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

async function errorCode(run: () => unknown): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof BusinessException ? error.code : 'UNKNOWN';
  }
}

describe('JwtAuthGuard', () => {
  const { tokens, jwt } = createTokenService();
  const userCache = { get: jest.fn() };
  const guard = new JwtAuthGuard(
    new Reflector(),
    tokens,
    userCache as unknown as UserAuthCacheService,
  );

  beforeEach(() => userCache.get.mockReset());

  const bearer = async (role: Role = Role.EMPLOYEE) =>
    `Bearer ${(await tokens.signAccessToken({ id: 'user-1', email: 'budi@absenyok.id', role })).token}`;

  it('endpoint @Public() dilewati tanpa token', async () => {
    const context = createContext({ headers: {} }, { [IS_PUBLIC_KEY]: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('tanpa header Authorization → TOKEN_INVALID', async () => {
    await expect(errorCode(() => guard.canActivate(createContext({ headers: {} })))).resolves.toBe(
      ErrorCode.TOKEN_INVALID,
    );
  });

  it('token kedaluwarsa → TOKEN_EXPIRED', async () => {
    const expired = await jwt.signAsync(
      { sub: 'user-1', email: 'x@y.id', role: 'EMPLOYEE', jti: 'x', exp: 1 },
      { secret: 'a'.repeat(64) },
    );
    const context = createContext({ headers: { authorization: `Bearer ${expired}` } });
    await expect(errorCode(() => guard.canActivate(context))).resolves.toBe(
      ErrorCode.TOKEN_EXPIRED,
    );
  });

  it('user terhapus → TOKEN_INVALID; user nonaktif → ACCOUNT_INACTIVE', async () => {
    const authorization = await bearer();

    userCache.get.mockResolvedValueOnce(null);
    await expect(
      errorCode(() => guard.canActivate(createContext({ headers: { authorization } }))),
    ).resolves.toBe(ErrorCode.TOKEN_INVALID);

    userCache.get.mockResolvedValueOnce({
      id: 'user-1',
      email: 'budi@absenyok.id',
      role: Role.EMPLOYEE,
      isActive: false,
    });
    await expect(
      errorCode(() => guard.canActivate(createContext({ headers: { authorization } }))),
    ).resolves.toBe(ErrorCode.ACCOUNT_INACTIVE);
  });

  it('sukses: request.user memakai role terbaru dari database, bukan dari token', async () => {
    userCache.get.mockResolvedValue({
      id: 'user-1',
      email: 'budi@absenyok.id',
      role: Role.ADMIN,
      isActive: true,
    });
    const request: TestRequest = { headers: { authorization: await bearer(Role.EMPLOYEE) } };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', email: 'budi@absenyok.id', role: Role.ADMIN });
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const employee: AuthUser = { id: 'u1', email: 'e@absenyok.id', role: Role.EMPLOYEE };
  const admin: AuthUser = { id: 'u2', email: 'a@absenyok.id', role: Role.ADMIN };

  it('tanpa @Roles(): semua user terautentikasi boleh', () => {
    expect(guard.canActivate(createContext({ headers: {}, user: employee }))).toBe(true);
  });

  it('role cocok → boleh', () => {
    const context = createContext(
      { headers: {}, user: admin },
      { [ROLES_KEY]: [Role.SUPER_ADMIN, Role.ADMIN] },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('EMPLOYEE ke endpoint @Roles(ADMIN) → 403 FORBIDDEN', async () => {
    const context = createContext({ headers: {}, user: employee }, { [ROLES_KEY]: [Role.ADMIN] });
    await expect(errorCode(() => guard.canActivate(context))).resolves.toBe(ErrorCode.FORBIDDEN);
  });
});
