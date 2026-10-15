import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Role } from '@/common/constants/roles';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthUser } from '@/common/types/auth-user.type';
import { hashPassword } from '@/common/utils/password.util';
import { AppConfigService } from '@/config/app.config';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { TokenService } from '@/modules/auth/token.service';
import { UserAuthCacheService } from '@/modules/auth/user-auth-cache.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createShift } from '../factories';
import { createE2eApp, expectNoSecrets, getCookie, resetDatabase } from './e2e-utils';

/** Endpoint khusus test untuk memverifikasi RolesGuard. */
@Controller('e2e-auth-probe')
class AuthProbeController {
  @Get('admin-only')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  adminOnly(@CurrentUser() user: AuthUser) {
    return { role: user.role };
  }

  @Get('any-role')
  anyRole(@CurrentUser() user: AuthUser) {
    return { role: user.role };
  }
}

const PASSWORD = 'Karyawan@123';

const USERS = {
  employee: { employeeCode: 'E2E-EMP', email: 'karyawan@e2e.test', role: Role.EMPLOYEE },
  admin: { employeeCode: 'E2E-ADM', email: 'admin@e2e.test', role: Role.ADMIN },
  inactive: { employeeCode: 'E2E-OFF', email: 'nonaktif@e2e.test', role: Role.EMPLOYEE },
  lockout: { employeeCode: 'E2E-LCK', email: 'kunci@e2e.test', role: Role.EMPLOYEE },
  password: { employeeCode: 'E2E-PWD', email: 'gantipass@e2e.test', role: Role.EMPLOYEE },
  deactivate: { employeeCode: 'E2E-DEA', email: 'dinonaktifkan@e2e.test', role: Role.EMPLOYEE },
} as const;

describe('Auth (e2e, MySQL database _test)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const ids: Record<keyof typeof USERS, string> = {} as Record<keyof typeof USERS, string>;

  // Throttle login dihitung per IP; setiap skenario memakai IP berbeda (X-Forwarded-For
  // dipercaya karena supertest terhubung dari loopback).
  let ipSeq = 0;
  const nextIp = () => `203.0.113.${(ipSeq += 1)}`;

  const login = (email: string, password = PASSWORD, ip = nextIp()) =>
    request(http).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password });

  const refresh = (refreshToken?: string) => {
    const req = request(http).post('/api/v1/auth/refresh').set('X-Forwarded-For', nextIp());
    return refreshToken ? req.set('Cookie', `ay_rt=${refreshToken}`) : req;
  };

  async function loginOk(email: string, password = PASSWORD) {
    const res = await login(email, password).expect(200);
    const body = res.body as { data: { accessToken: string } };
    const cookie = getCookie(res.headers['set-cookie'], 'ay_rt');
    if (!cookie) throw new Error('Cookie ay_rt tidak dipasang');
    return { accessToken: body.data.accessToken, refreshToken: cookie.value, res };
  }

  beforeAll(async () => {
    app = await createE2eApp([AuthProbeController]);
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const shift = await createShift(prisma, { name: 'Reguler E2E' });
    const passwordHash = await hashPassword(PASSWORD);

    for (const [key, user] of Object.entries(USERS) as [
      keyof typeof USERS,
      (typeof USERS)[keyof typeof USERS],
    ][]) {
      const created = await prisma.user.create({
        data: {
          ...user,
          name: `User ${user.employeeCode}`,
          passwordHash,
          isActive: key !== 'inactive',
          shiftId: user.role === Role.EMPLOYEE ? shift.id : null,
          boundDeviceId: key === 'employee' ? 'device-e2e-1' : null,
        },
      });
      ids[key] = created.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('alur lengkap: login → /auth/me → refresh → token lama ditolak → logout', () => {
    let accessToken: string;
    let firstRefresh: string;
    let secondRefresh: string;

    it('login: access token di body, refresh token hanya di cookie httpOnly', async () => {
      const { accessToken: token, refreshToken, res } = await loginOk(USERS.employee.email);
      accessToken = token;
      firstRefresh = refreshToken;

      expect(res.body.data).toEqual({
        accessToken: expect.any(String),
        expiresIn: 900,
        user: expect.objectContaining({
          id: ids.employee,
          email: USERS.employee.email,
          role: 'EMPLOYEE',
          hasBoundDevice: true,
          shift: expect.objectContaining({ name: 'Reguler E2E', startTime: '08:00' }),
          department: null,
        }),
      });
      expect(JSON.stringify(res.body)).not.toContain(refreshToken);
      expectNoSecrets(res.body);

      const rt = getCookie(res.headers['set-cookie'], 'ay_rt');
      expect(rt?.attributes).toEqual(
        expect.arrayContaining(['Path=/api/v1/auth', 'HttpOnly', 'SameSite=Lax']),
      );
      // Max-Age ≈ 7 hari (beberapa milidetik berlalu sejak token diterbitkan).
      const maxAge = Number(rt?.attributes.find((a) => a.startsWith('Max-Age='))?.slice(8));
      expect(maxAge).toBeGreaterThanOrEqual(604_790);
      expect(maxAge).toBeLessThanOrEqual(604_800);
      const session = getCookie(res.headers['set-cookie'], 'ay_session');
      expect(session?.value).toBe('1');
      expect(session?.attributes).toEqual(
        expect.arrayContaining(['Path=/', 'HttpOnly', 'SameSite=Lax']),
      );

      // Database hanya menyimpan hash SHA-256 refresh token.
      const stored = await prisma.refreshToken.findMany({ where: { userId: ids.employee } });
      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(app.get(TokenService).hashToken(refreshToken));
    });

    it('GET /auth/me dengan access token → UserProfile tanpa data rahasia', async () => {
      const res = await request(http)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toEqual({
        id: ids.employee,
        employeeCode: 'E2E-EMP',
        name: 'User E2E-EMP',
        email: USERS.employee.email,
        phone: null,
        position: null,
        role: 'EMPLOYEE',
        avatarUrl: null,
        department: null,
        shift: {
          id: expect.any(String),
          name: 'Reguler E2E',
          startTime: '08:00',
          endTime: '17:00',
          lateToleranceMinutes: 15,
          checkInOpenMinutes: 60,
          workDays: '1,2,3,4,5',
        },
        location: null,
        hasBoundDevice: true,
      });
      expectNoSecrets(res.body);
    });

    it('refresh: token dirotasi, access token baru bisa dipakai', async () => {
      const res = await refresh(firstRefresh).expect(200);
      const rotated = getCookie(res.headers['set-cookie'], 'ay_rt');
      expect(rotated?.value).toBeDefined();
      expect(rotated?.value).not.toBe(firstRefresh);
      secondRefresh = rotated?.value ?? '';

      await request(http)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${res.body.data.accessToken}`)
        .expect(200);
      expectNoSecrets(res.body);
    });

    it('token lama dipakai lagi → 401 REFRESH_TOKEN_REUSED, seluruh family dicabut, cookie dihapus', async () => {
      const res = await refresh(firstRefresh).expect(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_REUSED');
      expect(getCookie(res.headers['set-cookie'], 'ay_rt')?.attributes).toEqual(
        expect.arrayContaining([expect.stringMatching(/^Expires=Thu, 01 Jan 1970/)]),
      );

      // Token hasil rotasi juga ikut dicabut (indikasi pencurian) → tidak bisa dipakai lagi.
      const afterReuse = await refresh(secondRefresh).expect(401);
      expect(afterReuse.body.error.code).toBe('TOKEN_INVALID');

      const audit = await prisma.auditLog.count({
        where: { actorId: ids.employee, action: AuditAction.REFRESH_TOKEN_REUSE_DETECTED },
      });
      expect(audit).toBeGreaterThanOrEqual(1);
    });

    it('logout: token sesi dicabut, cookie dihapus, refresh berikutnya ditolak', async () => {
      const session = await loginOk(USERS.employee.email);

      const res = await request(http)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('Cookie', `ay_rt=${session.refreshToken}`)
        .expect(200);
      expect(res.body).toEqual({ success: true, data: null });
      expect(getCookie(res.headers['set-cookie'], 'ay_session')?.attributes).toEqual(
        expect.arrayContaining([expect.stringMatching(/^Expires=Thu, 01 Jan 1970/)]),
      );

      // Dicabut karena logout (bukan rotasi) → TOKEN_INVALID tanpa alarm pencurian.
      const after = await refresh(session.refreshToken).expect(401);
      expect(after.body.error.code).toBe('TOKEN_INVALID');

      const actions = await prisma.auditLog.findMany({
        where: { actorId: ids.employee },
        select: { action: true },
      });
      expect(actions.map((a) => a.action)).toEqual(
        expect.arrayContaining([AuditAction.LOGIN, AuditAction.LOGOUT]),
      );
    });
  });

  describe('JwtAuthGuard', () => {
    it('tanpa token → 401 TOKEN_INVALID', async () => {
      const res = await request(http).get('/api/v1/auth/me').expect(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    it('token kedaluwarsa → 401 TOKEN_EXPIRED (pemicu refresh di frontend)', async () => {
      const expired = await new JwtService({}).signAsync(
        { sub: ids.employee, email: USERS.employee.email, role: 'EMPLOYEE', jti: 'e2e', exp: 1 },
        { secret: app.get(AppConfigService).get('JWT_ACCESS_SECRET'), algorithm: 'HS256' },
      );
      const res = await request(http)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('akun dinonaktifkan setelah login → 403 ACCOUNT_INACTIVE (setelah cache di-invalidate)', async () => {
      const session = await loginOk(USERS.deactivate.email);
      await prisma.user.update({ where: { id: ids.deactivate }, data: { isActive: false } });
      await app.get(UserAuthCacheService).invalidate(ids.deactivate);

      const me = await request(http)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(403);
      expect(me.body.error.code).toBe('ACCOUNT_INACTIVE');

      const res = await refresh(session.refreshToken).expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('RolesGuard', () => {
    it('EMPLOYEE memanggil endpoint @Roles(ADMIN) → 403 FORBIDDEN', async () => {
      const { accessToken } = await loginOk(USERS.employee.email);
      const res = await request(http)
        .get('/api/v1/e2e-auth-probe/admin-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
      expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'Anda tidak memiliki akses' });

      await request(http)
        .get('/api/v1/e2e-auth-probe/any-role')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('ADMIN memanggil endpoint @Roles(ADMIN) → 200', async () => {
      const { accessToken } = await loginOk(USERS.admin.email);
      const res = await request(http)
        .get('/api/v1/e2e-auth-probe/admin-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data).toEqual({ role: 'ADMIN' });
    });
  });

  describe('Login gagal', () => {
    it('password salah dan email tidak terdaftar → respons generik identik', async () => {
      const wrong = await login(USERS.employee.email, 'SalahSekali1').expect(401);
      const unknown = await login('tidak.ada@e2e.test').expect(401);

      expect(wrong.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Email atau password salah',
      });
      expect(unknown.body.error).toEqual(wrong.body.error);
    });

    it('akun nonaktif → 403 ACCOUNT_INACTIVE', async () => {
      const res = await login(USERS.inactive.email).expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('validasi body → 400 VALIDATION_ERROR', async () => {
      const res = await login('bukan-email', '').expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const details = res.body.error.details as { field: string }[];
      expect(details.map((detail) => detail.field).sort()).toEqual(['email', 'password']);
    });

    it('5 kali password salah → percobaan berikutnya 423 ACCOUNT_LOCKED walau password benar', async () => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await login(USERS.lockout.email, `Salah${attempt}xyz`).expect(401);
      }

      const locked = await login(USERS.lockout.email).expect(423);
      expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
      expect(locked.body.error.message).toMatch(/coba lagi dalam 1[45] menit/);
      expect(locked.body.error.details).toEqual({ retryAfterMinutes: expect.any(Number) });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.lockout } });
      expect(user.failedLoginAttempts).toBe(5);
      expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    });

    it('setelah admin reset password, kegagalan lama & percobaan saat terkunci tidak dihitung lagi', async () => {
      // Lanjutan skenario di atas: akun masih terkunci, coba lagi beberapa kali (tetap 423).
      await login(USERS.lockout.email).expect(423);
      await login(USERS.lockout.email, 'Salah9xyz').expect(423);

      const { accessToken } = await loginOk(USERS.admin.email);
      await request(http)
        .post(`/api/v1/users/${ids.lockout}/reset-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Forwarded-For', nextIp())
        .send({ newPassword: 'Baru@12345' })
        .expect(200);

      // Satu kali salah ketik password baru → 401 biasa, BUKAN terkunci lagi.
      await login(USERS.lockout.email, 'Baru@1234x').expect(401);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.lockout } });
      expect(user.failedLoginAttempts).toBe(1);
      await loginOk(USERS.lockout.email, 'Baru@12345');
    });

    it('lebih dari 5 login per menit dari IP yang sama → 429 TOO_MANY_REQUESTS', async () => {
      const ip = '198.51.100.77';
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await login('throttle@e2e.test', PASSWORD, ip).expect(401);
      }
      const res = await login('throttle@e2e.test', PASSWORD, ip).expect(429);
      expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');

      // IP lain tidak terdampak.
      await login('throttle@e2e.test', PASSWORD, '198.51.100.78').expect(401);
    });
  });

  describe('Ganti password', () => {
    it('password lama salah → 400 pada field currentPassword', async () => {
      const { accessToken } = await loginOk(USERS.password.email);
      const res = await request(http)
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'BukanIni123', newPassword: 'PasswordBaru1' })
        .expect(400);
      expect(res.body.error.details).toEqual([
        { field: 'currentPassword', messages: ['Password saat ini salah'] },
      ]);
    });

    it('password baru lemah → 400 VALIDATION_ERROR', async () => {
      const { accessToken } = await loginOk(USERS.password.email);
      const res = await request(http)
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'lemah' })
        .expect(400);
      expect(res.body.error.details[0].field).toBe('newPassword');
    });

    it('sukses: semua sesi dicabut, password lama tidak berlaku, password baru bisa login', async () => {
      const sessionA = await loginOk(USERS.password.email);
      const sessionB = await loginOk(USERS.password.email);

      const res = await request(http)
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'PasswordBaru1' })
        .expect(200);
      expect(res.body).toEqual({ success: true, data: null });

      const active = await prisma.refreshToken.count({
        where: { userId: ids.password, revokedAt: null },
      });
      expect(active).toBe(0);
      await refresh(sessionB.refreshToken).expect(401);

      await login(USERS.password.email).expect(401);
      await login(USERS.password.email, 'PasswordBaru1').expect(200);

      const changed = await prisma.auditLog.count({
        where: { actorId: ids.password, action: AuditAction.PASSWORD_CHANGED },
      });
      expect(changed).toBe(1);
    });
  });
});
