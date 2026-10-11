import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { BusinessException } from '@/common/exceptions/business.exception';
import { TokenService } from '@/modules/auth/token.service';
import { createConfigStub, createTokenService, TEST_ENV } from './auth-test-helpers';

const user = { id: 'user-1', email: 'budi@absenyok.id', role: Role.EMPLOYEE };

const codeOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error instanceof BusinessException ? error.code : 'UNKNOWN'),
  );

describe('TokenService', () => {
  const { tokens, jwt } = createTokenService();

  it('access token: payload sub/email/role/jti, berlaku 15 menit', async () => {
    const { token, expiresIn } = await tokens.signAccessToken(user);
    const payload = await tokens.verifyAccessToken(token);

    expect(expiresIn).toBe(900);
    expect(payload).toMatchObject({ sub: 'user-1', email: user.email, role: 'EMPLOYEE' });
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('token kedaluwarsa → TOKEN_EXPIRED', async () => {
    const expired = await jwt.signAsync(
      {
        sub: 'user-1',
        email: user.email,
        role: 'EMPLOYEE',
        jti: 'x',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      { secret: TEST_ENV.JWT_ACCESS_SECRET, algorithm: 'HS256' },
    );
    await expect(codeOf(tokens.verifyAccessToken(expired))).resolves.toBe(ErrorCode.TOKEN_EXPIRED);
  });

  it('refresh token tidak bisa dipakai sebagai access token (secret berbeda)', async () => {
    const { token } = await tokens.signRefreshToken('user-1', 'family-1');
    await expect(codeOf(tokens.verifyAccessToken(token))).resolves.toBe(ErrorCode.TOKEN_INVALID);
  });

  it('access token tidak lolos sebagai refresh token', async () => {
    const { token } = await tokens.signAccessToken(user);
    await expect(tokens.verifyRefreshToken(token)).resolves.toBeNull();
  });

  it.each([
    ['tanda tangan dimanipulasi', async () => `${(await tokens.signAccessToken(user)).token}x`],
    [
      'algoritma "none"',
      () =>
        Promise.resolve(
          `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
            JSON.stringify({ sub: 'user-1', email: user.email, role: 'SUPER_ADMIN', jti: 'x' }),
          ).toString('base64url')}.`,
        ),
    ],
    [
      'role tidak dikenal',
      () =>
        jwt.signAsync(
          { sub: 'user-1', email: user.email, role: 'ROOT', jti: 'x' },
          { secret: TEST_ENV.JWT_ACCESS_SECRET, algorithm: 'HS256' },
        ),
    ],
    [
      'payload tanpa sub',
      () =>
        jwt.signAsync(
          { email: user.email, role: 'EMPLOYEE', jti: 'x' },
          { secret: TEST_ENV.JWT_ACCESS_SECRET, algorithm: 'HS256' },
        ),
    ],
  ])('%s → TOKEN_INVALID', async (_label, makeToken) => {
    await expect(codeOf(tokens.verifyAccessToken(await makeToken()))).resolves.toBe(
      ErrorCode.TOKEN_INVALID,
    );
  });

  it('refresh token: jti unik, familyId terbawa, kedaluwarsa 7 hari', async () => {
    const before = Date.now();
    const first = await tokens.signRefreshToken('user-1', 'family-1');
    const second = await tokens.signRefreshToken('user-1', 'family-1');

    expect(first.jti).not.toBe(second.jti);
    await expect(tokens.verifyRefreshToken(first.token)).resolves.toEqual({
      sub: 'user-1',
      familyId: 'family-1',
      jti: first.jti,
    });
    const ttl = first.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(7 * 86_400_000 - 1_000);
    expect(ttl).toBeLessThanOrEqual(7 * 86_400_000 + 1_000);
  });

  it('hashToken() menghasilkan SHA-256 hex 64 karakter yang deterministik', () => {
    const hash = tokens.hashToken('abc');
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hash).toHaveLength(64);
  });

  it('mengikuti JWT_ACCESS_EXPIRES_IN dari konfigurasi', async () => {
    const custom = new TokenService(jwt, createConfigStub({ JWT_ACCESS_EXPIRES_IN: '1h' }));
    await expect(custom.signAccessToken(user)).resolves.toMatchObject({ expiresIn: 3_600 });
  });
});
