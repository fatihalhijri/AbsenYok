import { ErrorCode } from '@/common/constants/error-codes';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import { hashPassword, verifyPassword } from '@/common/utils/password.util';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import type { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { AuthService } from '@/modules/auth/auth.service';
import type { TokenService } from '@/modules/auth/token.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { createTokenService } from './auth-test-helpers';

const PASSWORD = 'Karyawan@123';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT: ClientInfo = { ipAddress: '10.0.0.7', userAgent: 'jest' };

const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: USER_ID,
  employeeCode: 'EMP001',
  name: 'Budi Santoso',
  email: 'budi@absenyok.id',
  phone: null,
  position: 'Software Engineer',
  role: 'EMPLOYEE',
  avatarUrl: null,
  boundDeviceId: 'device-123',
  department: { id: 'dept-1', name: 'Teknologi Informasi' },
  shift: null,
  location: null,
  ...overrides,
});

function createPrismaMock() {
  const prisma = {
    user: { findFirst: jest.fn(), update: jest.fn() },
    refreshToken: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    auditLog: { count: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  // Transaksi interaktif: callback menerima client yang sama (mock).
  prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  );
  return prisma;
}

async function expectBusinessError(
  promise: Promise<unknown>,
  code: ErrorCode,
): Promise<BusinessException> {
  const error = await promise.then(
    () => {
      throw new Error(`Seharusnya melempar ${code}`);
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(BusinessException);
  expect((error as BusinessException).code).toBe(code);
  return error as BusinessException;
}

describe('AuthService', () => {
  let passwordHash: string;
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { log: jest.Mock };
  let tokens: TokenService;
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { log: jest.fn() };
    tokens = createTokenService().tokens;
    service = new AuthService(
      prisma as unknown as PrismaService,
      tokens,
      audit as unknown as AuditLogsService,
    );
    await service.onModuleInit();
  });

  const loginUser = (overrides: Record<string, unknown> = {}) => ({
    id: USER_ID,
    email: 'budi@absenyok.id',
    role: 'EMPLOYEE',
    isActive: true,
    passwordHash,
    lockedUntil: null,
    lastLoginAt: null,
    ...overrides,
  });

  describe('login', () => {
    it('sukses: menerbitkan token, menyimpan hash refresh token, reset counter, audit LOGIN', async () => {
      prisma.user.findFirst.mockResolvedValue(loginUser());
      prisma.user.update.mockResolvedValue(profileRow());

      const session = await service.login(
        { email: 'budi@absenyok.id', password: PASSWORD },
        CLIENT,
      );

      const access = await tokens.verifyAccessToken(session.accessToken);
      expect(access).toMatchObject({ sub: USER_ID, role: 'EMPLOYEE', email: 'budi@absenyok.id' });
      expect(access.jti).toEqual(expect.any(String));
      expect(session.expiresIn).toBe(900);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: expect.any(Date) },
        }),
      );

      const refreshPayload = await tokens.verifyRefreshToken(session.refreshToken);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: refreshPayload?.jti,
          userId: USER_ID,
          familyId: refreshPayload?.familyId,
          tokenHash: tokens.hashToken(session.refreshToken),
          ipAddress: '10.0.0.7',
          userAgent: 'jest',
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.LOGIN, actorId: USER_ID }),
        prisma,
      );

      // Profil aman: tanpa hash & device id mentah.
      expect(session.user).toMatchObject({ id: USER_ID, hasBoundDevice: true });
      expect(session.user).not.toHaveProperty('passwordHash');
      expect(session.user).not.toHaveProperty('boundDeviceId');
    });

    it('password salah: INVALID_CREDENTIALS, audit LOGIN_FAILED, counter bertambah tanpa kunci', async () => {
      prisma.user.findFirst.mockResolvedValue(loginUser());
      prisma.auditLog.count.mockResolvedValue(2);

      await expectBusinessError(
        service.login({ email: 'budi@absenyok.id', password: 'Salah123' }, CLIENT),
        ErrorCode.INVALID_CREDENTIALS,
      );

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_FAILED,
          actorId: USER_ID,
          metadata: { reason: 'INVALID_PASSWORD' },
        }),
        prisma,
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { failedLoginAttempts: 2 },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('email tidak terdaftar: respons identik dengan password salah', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const unknown = await expectBusinessError(
        service.login({ email: 'tidak.ada@absenyok.id', password: PASSWORD }, CLIENT),
        ErrorCode.INVALID_CREDENTIALS,
      );

      prisma.user.findFirst.mockResolvedValue(loginUser());
      prisma.auditLog.count.mockResolvedValue(1);
      const wrong = await expectBusinessError(
        service.login({ email: 'budi@absenyok.id', password: 'Salah123' }, CLIENT),
        ErrorCode.INVALID_CREDENTIALS,
      );

      expect(unknown.getResponse()).toEqual(wrong.getResponse());
      expect(unknown.getStatus()).toBe(401);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_FAILED,
          metadata: { email: 'tidak.ada@absenyok.id', reason: 'UNKNOWN_EMAIL' },
        }),
      );
    });

    it('kegagalan ke-5 dalam 15 menit mengunci akun selama 15 menit', async () => {
      prisma.user.findFirst.mockResolvedValue(loginUser());
      prisma.auditLog.count.mockResolvedValue(5);
      const before = Date.now();

      await expectBusinessError(
        service.login({ email: 'budi@absenyok.id', password: 'Salah123' }, CLIENT),
        ErrorCode.INVALID_CREDENTIALS,
      );

      const countWhere = prisma.auditLog.count.mock.calls[0][0].where;
      const windowStart = countWhere.createdAt.gte as Date;
      expect(before - windowStart.getTime()).toBeGreaterThanOrEqual(15 * 60_000 - 1_000);
      expect(countWhere).toMatchObject({
        actorId: USER_ID,
        action: AuditAction.LOGIN_FAILED,
        // Hanya password salah; percobaan saat terkunci/nonaktif tidak dihitung.
        metadata: { path: '$.reason', equals: 'INVALID_PASSWORD' },
      });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.failedLoginAttempts).toBe(5);
      const lockMs = (data.lockedUntil as Date).getTime() - before;
      expect(lockMs).toBeGreaterThanOrEqual(15 * 60_000 - 1_000);
      expect(lockMs).toBeLessThanOrEqual(15 * 60_000 + 1_000);
    });

    it('jendela hitungan dimulai dari lockedUntil (kunci berakhir / dibuka admin)', async () => {
      const lockedUntil = new Date(Date.now() - 60_000);
      prisma.user.findFirst.mockResolvedValue(loginUser({ lockedUntil }));
      prisma.auditLog.count.mockResolvedValue(1);

      await expectBusinessError(
        service.login({ email: 'budi@absenyok.id', password: 'Salah123' }, CLIENT),
        ErrorCode.INVALID_CREDENTIALS,
      );
      expect(prisma.auditLog.count.mock.calls[0][0].where.createdAt.gte).toEqual(lockedUntil);
    });

    it('jendela hitungan dimulai setelah login sukses terakhir', async () => {
      const lastLoginAt = new Date(Date.now() - 2 * 60_000);
      prisma.user.findFirst.mockResolvedValue(loginUser({ lastLoginAt }));
      prisma.auditLog.count.mockResolvedValue(1);

      await expectBusinessError(
        service.login({ email: 'budi@absenyok.id', password: 'Salah123' }, CLIENT),
        ErrorCode.INVALID_CREDENTIALS,
      );
      expect(prisma.auditLog.count.mock.calls[0][0].where.createdAt.gte).toEqual(lastLoginAt);
    });

    it('akun terkunci: 423 ACCOUNT_LOCKED dengan sisa menit, password tidak diperiksa', async () => {
      prisma.user.findFirst.mockResolvedValue(
        loginUser({ lockedUntil: new Date(Date.now() + 9.5 * 60_000) }),
      );

      const error = await expectBusinessError(
        service.login({ email: 'budi@absenyok.id', password: PASSWORD }, CLIENT),
        ErrorCode.ACCOUNT_LOCKED,
      );
      expect(error.getStatus()).toBe(423);
      expect(error.message).toBe('Akun dikunci sementara, coba lagi dalam 10 menit');
      expect(error.details).toEqual({ retryAfterMinutes: 10 });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('akun nonaktif (password benar): 403 ACCOUNT_INACTIVE tanpa menerbitkan token', async () => {
      prisma.user.findFirst.mockResolvedValue(loginUser({ isActive: false }));

      const error = await expectBusinessError(
        service.login({ email: 'budi@absenyok.id', password: PASSWORD }, CLIENT),
        ErrorCode.ACCOUNT_INACTIVE,
      );
      expect(error.getStatus()).toBe(403);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const FAMILY_ID = '22222222-2222-4222-8222-222222222222';

    async function issueRefreshToken() {
      const signed = await tokens.signRefreshToken(USER_ID, FAMILY_ID);
      const record = {
        id: signed.jti,
        userId: USER_ID,
        familyId: FAMILY_ID,
        revokedAt: null as Date | null,
        replacedBy: null as string | null,
        expiresAt: signed.expiresAt,
      };
      return { signed, record };
    }

    it('rotasi: token lama dicabut (replacedBy), token baru di family yang sama', async () => {
      const { signed, record } = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(record);
      prisma.user.findFirst.mockResolvedValue({ ...profileRow(), isActive: true });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const session = await service.refresh(signed.token, CLIENT);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: tokens.hashToken(signed.token) } }),
      );
      const next = await tokens.verifyRefreshToken(session.refreshToken);
      expect(next).toMatchObject({ sub: USER_ID, familyId: FAMILY_ID });
      expect(next?.jti).not.toBe(record.id);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: expect.any(Date), replacedBy: next?.jti },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: next?.jti,
          familyId: FAMILY_ID,
          tokenHash: tokens.hashToken(session.refreshToken),
        }),
      });
      await expect(tokens.verifyAccessToken(session.accessToken)).resolves.toMatchObject({
        sub: USER_ID,
      });
      expect(session.user).not.toHaveProperty('isActive');
    });

    it('token dicabut karena logout/ganti password (bukan rotasi) → TOKEN_INVALID tanpa alarm', async () => {
      const { signed, record } = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue({ ...record, revokedAt: new Date() });

      await expectBusinessError(service.refresh(signed.token, CLIENT), ErrorCode.TOKEN_INVALID);
      expect(audit.log).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('reuse terdeteksi: seluruh family dicabut, audit, 401 REFRESH_TOKEN_REUSED', async () => {
      const { signed, record } = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...record,
        revokedAt: new Date(),
        replacedBy: 'next-jti',
      });

      const error = await expectBusinessError(
        service.refresh(signed.token, CLIENT),
        ErrorCode.REFRESH_TOKEN_REUSED,
      );

      expect(error.getStatus()).toBe(401);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: FAMILY_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.REFRESH_TOKEN_REUSE_DETECTED,
          actorId: USER_ID,
          entityId: FAMILY_ID,
        }),
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('dua request paralel dengan token yang sama: yang kalah diperlakukan sebagai reuse', async () => {
      const { signed, record } = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(record);
      prisma.user.findFirst.mockResolvedValue({ ...profileRow(), isActive: true });
      prisma.refreshToken.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValue({ count: 3 });

      await expectBusinessError(
        service.refresh(signed.token, CLIENT),
        ErrorCode.REFRESH_TOKEN_REUSED,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it.each([
      ['tidak ada cookie', undefined],
      ['bukan JWT', 'bukan-token'],
    ])('%s → TOKEN_INVALID', async (_label, token) => {
      await expectBusinessError(service.refresh(token, CLIENT), ErrorCode.TOKEN_INVALID);
    });

    it('JWT valid tetapi tidak ada di database → TOKEN_INVALID', async () => {
      const { signed } = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expectBusinessError(service.refresh(signed.token, CLIENT), ErrorCode.TOKEN_INVALID);
    });

    it('user dinonaktifkan → family dicabut & ACCOUNT_INACTIVE', async () => {
      const { signed, record } = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(record);
      prisma.user.findFirst.mockResolvedValue({ ...profileRow(), isActive: false });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await expectBusinessError(service.refresh(signed.token, CLIENT), ErrorCode.ACCOUNT_INACTIVE);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: FAMILY_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('logout', () => {
    it('mencabut family token milik user & audit LOGOUT', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ userId: USER_ID, familyId: 'fam-1' });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(USER_ID, 'token-cookie', CLIENT);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.LOGOUT, metadata: { familyId: 'fam-1' } }),
      );
    });

    it('tidak mencabut token milik user lain', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ userId: 'user-lain', familyId: 'fam-x' });
      await service.logout(USER_ID, 'token-cookie', CLIENT);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('password lama salah → 400 VALIDATION_ERROR pada field currentPassword', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: USER_ID, passwordHash });

      const error = await expectBusinessError(
        service.changePassword(
          USER_ID,
          { currentPassword: 'Salah123', newPassword: 'Baru12345' },
          CLIENT,
        ),
        ErrorCode.VALIDATION_ERROR,
      );
      expect(error.getStatus()).toBe(400);
      expect(error.details).toEqual([
        { field: 'currentPassword', messages: ['Password saat ini salah'] },
      ]);
    });

    it('password baru sama dengan yang lama ditolak', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: USER_ID, passwordHash });
      await expectBusinessError(
        service.changePassword(
          USER_ID,
          { currentPassword: PASSWORD, newPassword: PASSWORD },
          CLIENT,
        ),
        ErrorCode.VALIDATION_ERROR,
      );
    });

    it('sukses: hash argon2id baru, semua refresh token dicabut, audit PASSWORD_CHANGED', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: USER_ID, passwordHash });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.changePassword(
        USER_ID,
        { currentPassword: PASSWORD, newPassword: 'PasswordBaru1' },
        CLIENT,
      );

      const newHash = prisma.user.update.mock.calls[0][0].data.passwordHash as string;
      expect(newHash.startsWith('$argon2id$')).toBe(true);
      await expect(verifyPassword(newHash, 'PasswordBaru1')).resolves.toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PASSWORD_CHANGED,
          metadata: { revokedSessions: 3 },
        }),
        prisma,
      );
    });
  });
});
