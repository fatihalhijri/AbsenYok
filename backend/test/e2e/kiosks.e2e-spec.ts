import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { BusinessException } from '@/common/exceptions/business.exception';
import { combineDateAndTime, toDbDate, todayDateString } from '@/common/utils/date.util';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { QrService } from '@/modules/qr/qr.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createE2eApp,
  createIpSequence,
  createUserFixture,
  errorFields,
  expectNoSecrets,
  loginToken,
  resetDatabase,
} from './e2e-utils';

const TOKEN_PATTERN = /^AY1\.K\.[0-9a-f-]{36}\.\d+\.[A-Za-z0-9_-]{22}$/;

describe('Kiosks & QR (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  let qr: QrService;
  const nextIp = createIpSequence('198.20.0');

  let adminToken: string;
  let employeeToken: string;
  let employeeId: string;
  let locationId: string;
  let inactiveLocationId: string;
  let kioskId: string;

  /** Semua teks respons dikumpulkan untuk memastikan secret tidak pernah bocor. */
  const responses: string[] = [];
  const track = <T extends { text: string; body: unknown }>(res: T): T => {
    responses.push(res.text);
    expectNoSecrets(res.body);
    return res;
  };

  const as = (token: string) => ({
    get: (url: string) => request(http).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(http).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(http).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(http).delete(url).set('Authorization', `Bearer ${token}`),
  });

  const errorCodeOf = async (run: () => Promise<unknown>) => {
    try {
      await run();
      return null;
    } catch (error) {
      return error instanceof BusinessException ? error.code : 'UNKNOWN';
    }
  };

  beforeAll(async () => {
    app = await createE2eApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    qr = app.get(QrService);
    await resetDatabase(prisma);

    locationId = (
      await prisma.location.create({
        data: { name: 'Kantor Pusat', latitude: '-6.2000000', longitude: '106.8166667' },
      })
    ).id;
    inactiveLocationId = (
      await prisma.location.create({
        data: { name: 'Tutup', latitude: '-6.3', longitude: '106.9', isActive: false },
      })
    ).id;

    await createUserFixture(prisma, {
      employeeCode: 'ADM1',
      email: 'adm@k.test',
      role: Role.ADMIN,
    });
    employeeId = (
      await createUserFixture(prisma, {
        employeeCode: 'EMP1',
        email: 'emp@k.test',
        role: Role.EMPLOYEE,
      })
    ).id;
    adminToken = await loginToken(http, 'adm@k.test', nextIp());
    employeeToken = await loginToken(http, 'emp@k.test', nextIp());
  });

  afterAll(async () => {
    // Nilai secret aktual dari database tidak boleh muncul di respons mana pun.
    const secrets = (await prisma.kiosk.findMany({ select: { secret: true } })).map(
      (k) => k.secret,
    );
    for (const text of responses) {
      for (const secret of secrets) expect(text).not.toContain(secret);
    }
    await app.close();
  });

  describe('CRUD', () => {
    it('membuat kiosk: secret 64 byte hex dibuat server, tidak ada di respons', async () => {
      const res = track(
        await as(adminToken)
          .post('/api/v1/kiosks')
          .send({ name: 'Lobi Utama', locationId })
          .expect(201),
      );
      kioskId = res.body.data.id;
      expect(res.body.data).toEqual({
        id: expect.any(String),
        name: 'Lobi Utama',
        qrIntervalSeconds: 30,
        isActive: true,
        lastSeenAt: null,
        location: { id: locationId, name: 'Kantor Pusat' },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const row = await prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } });
      expect(row.secret).toMatch(/^[0-9a-f]{128}$/);
    });

    it('lokasi nonaktif / interval di luar batas → 400', async () => {
      const inactive = track(
        await as(adminToken)
          .post('/api/v1/kiosks')
          .send({ name: 'Kiosk X', locationId: inactiveLocationId })
          .expect(400),
      );
      expect(errorFields(inactive.body)).toEqual(['locationId']);

      const interval = track(
        await as(adminToken)
          .post('/api/v1/kiosks')
          .send({ name: 'Kiosk Y', locationId, qrIntervalSeconds: 5 })
          .expect(400),
      );
      expect(errorFields(interval.body)).toEqual(['qrIntervalSeconds']);
    });

    it('daftar & detail tanpa secret', async () => {
      const list = track(await as(adminToken).get('/api/v1/kiosks?search=lobi').expect(200));
      expect(list.body.meta.total).toBe(1);
      track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}`).expect(200));
    });

    it('EMPLOYEE tidak boleh mengakses kiosk', async () => {
      track(await as(employeeToken).get('/api/v1/kiosks').expect(403));
      track(await as(employeeToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(403));
    });
  });

  describe('QR kiosk', () => {
    it('GET /kiosks/:id/qr → token valid, expiresAt, serverTime, info kiosk; lastSeenAt diperbarui', async () => {
      const res = track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(200));
      const data = res.body.data as {
        token: string;
        expiresAt: string;
        intervalSeconds: number;
        serverTime: string;
        kiosk: unknown;
      };

      expect(data.token).toMatch(TOKEN_PATTERN);
      expect(data.intervalSeconds).toBe(30);
      expect(data.kiosk).toEqual({ id: kioskId, name: 'Lobi Utama', locationName: 'Kantor Pusat' });
      const remaining = Date.parse(data.expiresAt) - Date.parse(data.serverTime);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(30_000);

      await expect(qr.verifyKioskToken(data.token)).resolves.toMatchObject({ kioskId });
      const row = await prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } });
      expect(row.lastSeenAt).not.toBeNull();
    });

    it('lastSeenAt tidak ditulis ulang dalam 1 menit (polling tidak membebani DB)', async () => {
      const before = (await prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } })).lastSeenAt;
      track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(200));
      const after = (await prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } })).lastSeenAt;
      expect(after?.getTime()).toBe(before?.getTime());
    });

    it('rotate-secret → QR lama QR_INVALID, QR baru valid, audit tercatat', async () => {
      const oldToken = (
        track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(200)).body as {
          data: { token: string };
        }
      ).data.token;
      const oldSecret = (await prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } })).secret;

      track(await as(adminToken).post(`/api/v1/kiosks/${kioskId}/rotate-secret`).expect(200));

      const newSecret = (await prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } })).secret;
      expect(newSecret).not.toBe(oldSecret);
      await expect(errorCodeOf(() => qr.verifyKioskToken(oldToken))).resolves.toBe(
        ErrorCode.QR_INVALID,
      );

      const fresh = track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(200));
      await expect(
        qr.verifyKioskToken((fresh.body as { data: { token: string } }).data.token),
      ).resolves.toBeDefined();

      expect(
        await prisma.auditLog.count({
          where: { action: AuditAction.KIOSK_SECRET_ROTATED, entityId: kioskId },
        }),
      ).toBe(1);
    });

    it('kiosk dinonaktifkan → GET qr 422 KIOSK_INACTIVE dan token yang beredar ditolak', async () => {
      const token = (
        track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(200)).body as {
          data: { token: string };
        }
      ).data.token;

      track(
        await as(adminToken)
          .patch(`/api/v1/kiosks/${kioskId}`)
          .send({ isActive: false })
          .expect(200),
      );
      const res = track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(422));
      expect(res.body.error.code).toBe('KIOSK_INACTIVE');
      await expect(errorCodeOf(() => qr.verifyKioskToken(token))).resolves.toBe(
        ErrorCode.KIOSK_INACTIVE,
      );

      track(
        await as(adminToken)
          .patch(`/api/v1/kiosks/${kioskId}`)
          .send({ isActive: true })
          .expect(200),
      );
    });

    it('lokasi dinonaktifkan lewat PATCH /locations → kiosk langsung tidak aktif (cache dibuang)', async () => {
      track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(200));
      track(
        await as(adminToken)
          .patch(`/api/v1/locations/${locationId}`)
          .send({ isActive: false })
          .expect(200),
      );
      track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(422));
      track(
        await as(adminToken)
          .patch(`/api/v1/locations/${locationId}`)
          .send({ isActive: true })
          .expect(200),
      );
      track(await as(adminToken).get(`/api/v1/kiosks/${kioskId}/qr`).expect(200));
    });
  });

  describe('recent-scans', () => {
    it('10 scan berhasil terakhir hari ini dengan tipe masuk/pulang & status', async () => {
      const today = todayDateString();
      const t = (time: string) => combineDateAndTime(today, time);
      const budi = await createUserFixture(prisma, {
        employeeCode: 'BUDI',
        email: 'budi@k.test',
        role: Role.EMPLOYEE,
      });
      const sari = await createUserFixture(prisma, {
        employeeCode: 'SARI',
        email: 'sari@k.test',
        role: Role.EMPLOYEE,
      });
      const otherKiosk = await prisma.kiosk.create({
        data: { name: 'Lain', locationId, secret: 'x'.repeat(128) },
      });

      await prisma.attendance.createMany({
        data: [
          {
            userId: budi.id,
            date: toDbDate(today),
            status: 'PRESENT',
            checkInAt: t('07:50'),
            kioskId,
          },
          {
            userId: sari.id,
            date: toDbDate(today),
            status: 'LATE',
            checkInAt: t('08:20'),
            checkOutAt: t('17:05'),
            lateMinutes: 20,
            kioskId,
          },
        ],
      });
      await prisma.attendanceScanLog.createMany({
        data: [
          { userId: budi.id, kioskId, scanType: 'KIOSK', success: true, createdAt: t('07:50') },
          { userId: sari.id, kioskId, scanType: 'KIOSK', success: true, createdAt: t('08:20') },
          { userId: sari.id, kioskId, scanType: 'KIOSK', success: true, createdAt: t('17:05') },
          // Diabaikan: gagal, kiosk lain, kemarin.
          {
            userId: budi.id,
            kioskId,
            scanType: 'KIOSK',
            success: false,
            errorCode: 'QR_EXPIRED',
            createdAt: t('07:49'),
          },
          {
            userId: budi.id,
            kioskId: otherKiosk.id,
            scanType: 'KIOSK',
            success: true,
            createdAt: t('09:00'),
          },
          {
            userId: budi.id,
            kioskId,
            scanType: 'KIOSK',
            success: true,
            createdAt: new Date(t('00:00').getTime() - 60_000),
          },
        ],
      });

      const res = track(
        await as(adminToken).get(`/api/v1/kiosks/${kioskId}/recent-scans`).expect(200),
      );
      expect(
        (res.body.data as { employeeCode: string; type: string; status: string }[]).map(
          ({ employeeCode, type, status }) => ({ employeeCode, type, status }),
        ),
      ).toEqual([
        { employeeCode: 'SARI', type: 'CHECK_OUT', status: 'LATE' },
        { employeeCode: 'SARI', type: 'CHECK_IN', status: 'LATE' },
        { employeeCode: 'BUDI', type: 'CHECK_IN', status: 'PRESENT' },
      ]);
      expect(res.body.data[0]).toMatchObject({ name: 'User SARI', time: t('17:05').toISOString() });
    });
  });

  describe('hapus kiosk', () => {
    it('ditolak bila sudah punya riwayat absensi; kiosk tanpa riwayat bisa dihapus', async () => {
      const res = track(await as(adminToken).delete(`/api/v1/kiosks/${kioskId}`).expect(409));
      expect(res.body.error.message).toContain('nonaktifkan');

      const spare = track(
        await as(adminToken)
          .post('/api/v1/kiosks')
          .send({ name: 'Cadangan', locationId })
          .expect(201),
      );
      track(await as(adminToken).delete(`/api/v1/kiosks/${spare.body.data.id}`).expect(200));
      track(await as(adminToken).get(`/api/v1/kiosks/${spare.body.data.id}`).expect(404));
    });
  });

  describe('QR personal', () => {
    it('EMPLOYEE: GET /users/me/qr → token personal miliknya, valid diverifikasi', async () => {
      const res = track(await as(employeeToken).get('/api/v1/users/me/qr').expect(200));
      const data = res.body.data as { token: string; expiresAt: string; intervalSeconds: number };

      expect(data.token).toMatch(
        new RegExp(`^AY1\\.P\\.${employeeId}\\.\\d+\\.[A-Za-z0-9_-]{22}$`),
      );
      expect(data.intervalSeconds).toBe(60);
      expect(Date.parse(data.expiresAt)).toBeGreaterThan(Date.now());
      expect(qr.verifyPersonalToken(data.token)).toMatchObject({ userId: employeeId });
    });

    it('ADMIN tidak memiliki QR personal → 403', async () => {
      track(await as(adminToken).get('/api/v1/users/me/qr').expect(403));
    });
  });
});
