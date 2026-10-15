import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Role } from '@/common/constants/roles';
import { PrismaService } from '@/prisma/prisma.service';
import { createLeaveRequest, createShift, createUser } from '../factories';
import {
  createE2eApp,
  createIpSequence,
  errorFields,
  loginToken,
  resetDatabase,
} from './e2e-utils';

/** UUID acak yang tidak ada di database. */
const UNKNOWN_ID = '9b2f8c1e-4d5a-4e6b-8c7d-0e1f2a3b4c5d';

/**
 * Hardening OWASP API Top 10 yang lintas modul: BOLA, mass assignment, batas ukuran body.
 * (Rate limit login/scan, helmet & CORS diuji di auth/attendance/app e2e.)
 */
describe('Security hardening (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const nextIp = createIpSequence('198.51.100');

  const ids = {} as Record<'superAdmin' | 'admin' | 'admin2' | 'alice' | 'bob', string>;
  const tokens = {} as Record<keyof typeof ids, string>;
  let aliceLeaveId: string;

  const as = (who: keyof typeof ids) => {
    const auth = { Authorization: `Bearer ${tokens[who]}` };
    return {
      get: (url: string) => request(http).get(url).set(auth),
      post: (url: string) => request(http).post(url).set(auth),
      patch: (url: string) => request(http).patch(url).set(auth),
      delete: (url: string) => request(http).delete(url).set(auth),
    };
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const shiftId = (await createShift(prisma)).id;
    const people = [
      ['superAdmin', Role.SUPER_ADMIN],
      ['admin', Role.ADMIN],
      ['admin2', Role.ADMIN],
      ['alice', Role.EMPLOYEE],
      ['bob', Role.EMPLOYEE],
    ] as const;
    for (const [key, role] of people) {
      ids[key] = (
        await createUser(prisma, {
          employeeCode: `SEC-${key.toUpperCase()}`,
          email: `${key.toLowerCase()}@sec.test`,
          role,
          shiftId: role === Role.EMPLOYEE ? shiftId : undefined,
        })
      ).id;
      tokens[key] = await loginToken(http, `${key.toLowerCase()}@sec.test`, nextIp());
    }

    aliceLeaveId = (
      await createLeaveRequest(prisma, {
        userId: ids.alice,
        startDate: '2026-10-19',
        status: 'PENDING',
        attachmentUrl: 'leave/00000000-0000-4000-8000-000000000000.pdf',
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Broken Object Level Authorization', () => {
    it('karyawan tidak bisa melihat, membatalkan, atau mengunduh lampiran pengajuan orang lain', async () => {
      const detail = await as('bob').get(`/api/v1/leave-requests/${aliceLeaveId}`).expect(403);
      expect(detail.body.error.code).toBe('FORBIDDEN');
      await as('bob').patch(`/api/v1/leave-requests/${aliceLeaveId}/cancel`).expect(403);
      await as('bob').get(`/api/v1/leave-requests/${aliceLeaveId}/attachment`).expect(403);

      const unchanged = await prisma.leaveRequest.findUniqueOrThrow({
        where: { id: aliceLeaveId },
      });
      expect(unchanged.status).toBe('PENDING');
    });

    it('pemilik & admin tetap bisa melihat pengajuan tersebut', async () => {
      await as('alice').get(`/api/v1/leave-requests/${aliceLeaveId}`).expect(200);
      await as('admin').get(`/api/v1/leave-requests/${aliceLeaveId}`).expect(200);
    });

    it('riwayat "me" hanya berisi data milik sendiri', async () => {
      const res = await as('bob').get('/api/v1/leave-requests/me?year=2026').expect(200);
      expect(res.body.data).toEqual([]);
    });

    it.each([
      ['get', `/api/v1/users/${UNKNOWN_ID}`],
      ['patch', `/api/v1/users/${UNKNOWN_ID}`],
      ['get', `/api/v1/attendance/${UNKNOWN_ID}`],
      ['patch', `/api/v1/attendance/${UNKNOWN_ID}`],
      ['get', `/api/v1/kiosks/${UNKNOWN_ID}/qr`],
      ['post', `/api/v1/kiosks/${UNKNOWN_ID}/rotate-secret`],
      ['delete', `/api/v1/shifts/${UNKNOWN_ID}`],
      ['patch', `/api/v1/locations/${UNKNOWN_ID}`],
      ['delete', `/api/v1/departments/${UNKNOWN_ID}`],
      ['patch', `/api/v1/holidays/${UNKNOWN_ID}`],
      ['patch', `/api/v1/leave-requests/${UNKNOWN_ID}/approve`],
    ] as const)('karyawan → %s %s ditolak 403 (sebelum data dicari)', async (method, url) => {
      const res = await as('alice')[method](url).send({}).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('ADMIN tidak bisa mengubah/menonaktifkan/reset akun ADMIN lain & SUPER_ADMIN', async () => {
      await as('admin').patch(`/api/v1/users/${ids.admin2}`).send({ name: 'Diretas' }).expect(403);
      await as('admin')
        .patch(`/api/v1/users/${ids.superAdmin}/status`)
        .send({ isActive: false })
        .expect(403);
      await as('admin')
        .post(`/api/v1/users/${ids.superAdmin}/reset-password`)
        .send({ newPassword: 'Diretas@123' })
        .expect(403);
      await as('admin').delete(`/api/v1/users/${ids.alice}`).expect(403);

      const admin2 = await prisma.user.findUniqueOrThrow({ where: { id: ids.admin2 } });
      expect(admin2.name).toBe('User SEC-ADMIN2');
    });
  });

  describe('Mass assignment', () => {
    it('karyawan tidak bisa menaikkan role/status lewat PATCH /users/me', async () => {
      const res = await as('alice')
        .patch('/api/v1/users/me')
        .send({ name: 'Alice', role: Role.SUPER_ADMIN, isActive: true, boundDeviceId: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(errorFields(res.body)).toEqual(['boundDeviceId', 'isActive', 'role']);
      const alice = await prisma.user.findUniqueOrThrow({ where: { id: ids.alice } });
      expect(alice.role).toBe(Role.EMPLOYEE);
    });

    it('ADMIN tidak bisa menyisipkan passwordHash / deletedAt lewat PATCH /users/:id', async () => {
      const res = await as('admin')
        .patch(`/api/v1/users/${ids.bob}`)
        .send({ passwordHash: 'x', deletedAt: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('karyawan tidak bisa langsung membuat pengajuan berstatus APPROVED', async () => {
      const res = await as('alice')
        .post('/api/v1/leave-requests')
        .send({
          type: 'PERMIT',
          startDate: '2026-10-19',
          endDate: '2026-10-19',
          reason: 'Urusan keluarga',
          status: 'APPROVED',
        })
        .expect(400);
      expect(res.body.error.details).toEqual([
        { field: 'status', messages: ['property status should not exist'] },
      ]);
    });
  });

  describe('Batas ukuran body (1 MB)', () => {
    const MB = 1024 * 1024;

    it('JSON > 1 MB → 413 format error standar tanpa stack trace', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-Forwarded-For', nextIp())
        .send(JSON.stringify({ email: 'a'.repeat(MB + 10), password: 'x' }))
        .expect(413);
      expect(res.body).toEqual({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Ukuran data terlalu besar' },
        path: '/api/v1/auth/login',
        timestamp: expect.any(String),
      });
      expect(res.text).not.toContain('stack');
    });

    it('urlencoded > 1 MB → 413', async () => {
      await request(http)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Forwarded-For', nextIp())
        .send(`email=${'a'.repeat(MB + 10)}&password=x`)
        .expect(413);
    });

    it('JSON < 1 MB tetap diproses (ditolak validasi biasa, bukan 413)', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', nextIp())
        .send({ email: `${'a'.repeat(900 * 1024)}@x.id`, password: 'x' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('JSON rusak → 400 BAD_REQUEST', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-Forwarded-For', nextIp())
        .send('{"email":')
        .expect(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });
});
