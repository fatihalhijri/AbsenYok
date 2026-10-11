import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Role } from '@/common/constants/roles';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createE2eApp,
  createIpSequence,
  createUserFixture,
  errorFields,
  loginToken,
  resetDatabase,
} from './e2e-utils';

type OpenApiOperation = {
  summary?: string;
  tags?: string[];
  security?: unknown[];
  responses: Record<string, { content?: Record<string, { schema?: unknown; example?: unknown }> }>;
};

describe('Master data & settings (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const nextIp = createIpSequence('198.19.0');
  let superAdminToken: string;
  let adminToken: string;
  let employeeToken: string;
  let superAdminId: string;

  const as = (token: string) => ({
    get: (url: string) => request(http).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(http).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(http).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(http).delete(url).set('Authorization', `Bearer ${token}`),
  });

  beforeAll(async () => {
    app = await createE2eApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    superAdminId = (
      await createUserFixture(prisma, {
        employeeCode: 'SA1',
        email: 'sa@md.test',
        role: Role.SUPER_ADMIN,
      })
    ).id;
    await createUserFixture(prisma, {
      employeeCode: 'ADM1',
      email: 'adm@md.test',
      role: Role.ADMIN,
    });
    await createUserFixture(prisma, {
      employeeCode: 'EMP1',
      email: 'emp@md.test',
      role: Role.EMPLOYEE,
    });

    superAdminToken = await loginToken(http, 'sa@md.test', nextIp());
    adminToken = await loginToken(http, 'adm@md.test', nextIp());
    employeeToken = await loginToken(http, 'emp@md.test', nextIp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Departments', () => {
    let departmentId: string;

    it('kode disimpan huruf besar; daftar berpaginasi dengan userCount', async () => {
      const res = await as(adminToken)
        .post('/api/v1/departments')
        .send({ code: ' it ', name: 'Teknologi Informasi' })
        .expect(201);
      departmentId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        code: 'IT',
        name: 'Teknologi Informasi',
        userCount: 0,
      });

      const list = await as(adminToken).get('/api/v1/departments?search=tekno').expect(200);
      expect(list.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('kode duplikat → 409 dengan field code', async () => {
      const res = await as(adminToken)
        .post('/api/v1/departments')
        .send({ code: 'IT', name: 'Lain' })
        .expect(409);
      expect(res.body.error.details).toEqual([
        { field: 'code', messages: ['Kode departemen sudah digunakan'] },
      ]);
    });

    it('DELETE ditolak (409) bila masih ada karyawan aktif, berhasil setelah kosong', async () => {
      const user = await createUserFixture(prisma, {
        employeeCode: 'EMP-IT',
        email: 'it@md.test',
        role: Role.EMPLOYEE,
      });
      await prisma.user.update({ where: { id: user.id }, data: { departmentId } });

      const res = await as(adminToken).delete(`/api/v1/departments/${departmentId}`).expect(409);
      expect(res.body.error.message).toBe('Departemen masih memiliki 1 karyawan aktif');

      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
      await as(adminToken).delete(`/api/v1/departments/${departmentId}`).expect(200);
      const detached = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(detached.departmentId).toBeNull();
    });

    it('EMPLOYEE tidak boleh mengakses departemen', async () => {
      await as(employeeToken).get('/api/v1/departments').expect(403);
    });
  });

  describe('Shifts', () => {
    const shift = { name: 'Pagi', startTime: '07:00', endTime: '15:00' };

    it('workDays dinormalisasi & default diterapkan', async () => {
      const res = await as(adminToken)
        .post('/api/v1/shifts')
        .send({ ...shift, workDays: '5,1,3' })
        .expect(201);
      expect(res.body.data).toMatchObject({
        name: 'Pagi',
        workDays: '1,3,5',
        lateToleranceMinutes: 15,
        checkInOpenMinutes: 60,
        isActive: true,
        userCount: 0,
      });
    });

    it.each([
      ['format jam salah', { startTime: '7:00' }, 'startTime'],
      [
        'jam pulang ≤ jam masuk',
        { name: 'Malam', startTime: '22:00', endTime: '06:00' },
        'endTime',
      ],
      ['workDays duplikat / di luar 1–7', { name: 'Aneh', workDays: '1,1,8' }, 'workDays'],
      [
        'jendela absen sebelum 00:00',
        { name: 'Dini', startTime: '00:30', endTime: '08:00' },
        'checkInOpenMinutes',
      ],
    ])('%s → 400 pada field %s', async (_label, overrides, field) => {
      const res = await as(adminToken)
        .post('/api/v1/shifts')
        .send({ ...shift, name: 'Shift Uji', ...overrides })
        .expect(400);
      expect(errorFields(res.body)).toContain(field);
    });

    it('PATCH tervalidasi terhadap nilai lama (endTime saja yang lebih awal → 400)', async () => {
      const created = await as(adminToken)
        .post('/api/v1/shifts')
        .send({ name: 'Siang', startTime: '12:00', endTime: '20:00' })
        .expect(201);
      await as(adminToken)
        .patch(`/api/v1/shifts/${created.body.data.id}`)
        .send({ endTime: '11:00' })
        .expect(400);
      const ok = await as(adminToken)
        .patch(`/api/v1/shifts/${created.body.data.id}`)
        .send({ endTime: '21:00', workDays: '6,7' })
        .expect(200);
      expect(ok.body.data).toMatchObject({ endTime: '21:00', workDays: '6,7' });
    });

    it('DELETE ditolak bila shift masih dipakai karyawan', async () => {
      const created = await as(adminToken)
        .post('/api/v1/shifts')
        .send({ name: 'Dipakai', startTime: '08:00', endTime: '16:00' })
        .expect(201);
      const user = await createUserFixture(prisma, {
        employeeCode: 'EMP-SH',
        email: 'shift@md.test',
        role: Role.EMPLOYEE,
        shiftId: created.body.data.id,
      });
      await as(adminToken).delete(`/api/v1/shifts/${created.body.data.id}`).expect(409);
      await prisma.user.update({ where: { id: user.id }, data: { shiftId: null } });
      await as(adminToken).delete(`/api/v1/shifts/${created.body.data.id}`).expect(200);
    });
  });

  describe('Locations', () => {
    const location = {
      name: 'Kantor Cabang',
      latitude: -6.9175,
      longitude: 107.6191,
      radiusMeters: 150,
    };

    it('koordinat dikembalikan sebagai number', async () => {
      const res = await as(adminToken).post('/api/v1/locations').send(location).expect(201);
      expect(res.body.data).toMatchObject({ ...location, isActive: true, kioskCount: 0 });
      expect(typeof res.body.data.latitude).toBe('number');
    });

    it.each([
      ['latitude > 90', { latitude: 91 }, 'latitude'],
      ['longitude < -180', { longitude: -181 }, 'longitude'],
      ['radius < 10 m', { radiusMeters: 5 }, 'radiusMeters'],
      ['radius > 5000 m', { radiusMeters: 6000 }, 'radiusMeters'],
    ])('%s → 400', async (_label, overrides, field) => {
      const res = await as(adminToken)
        .post('/api/v1/locations')
        .send({ ...location, ...overrides })
        .expect(400);
      expect(res.body.error.details[0].field).toBe(field);
    });

    it('DELETE ditolak (409) bila masih dipakai kiosk aktif', async () => {
      const created = await as(adminToken)
        .post('/api/v1/locations')
        .send({ ...location, name: 'Gudang' })
        .expect(201);
      await prisma.kiosk.create({
        data: { name: 'Kiosk Gudang', locationId: created.body.data.id, secret: 'x'.repeat(64) },
      });
      const res = await as(adminToken)
        .delete(`/api/v1/locations/${created.body.data.id}`)
        .expect(409);
      expect(res.body.error.message).toBe('Lokasi masih dipakai 1 kiosk aktif');
    });
  });

  describe('Holidays', () => {
    it('admin menambah, semua role (termasuk EMPLOYEE) bisa melihat per tahun', async () => {
      await as(adminToken)
        .post('/api/v1/holidays')
        .send({ date: '2026-12-25', name: 'Hari Raya Natal' })
        .expect(201);
      await as(adminToken)
        .post('/api/v1/holidays')
        .send({ date: '2027-01-01', name: 'Tahun Baru' })
        .expect(201);

      const res = await as(employeeToken).get('/api/v1/holidays?year=2026').expect(200);
      expect(res.body.data).toEqual([
        { id: expect.any(String), date: '2026-12-25', name: 'Hari Raya Natal' },
      ]);
    });

    it('EMPLOYEE tidak boleh menambah hari libur', async () => {
      await as(employeeToken)
        .post('/api/v1/holidays')
        .send({ date: '2026-08-17', name: 'X' })
        .expect(403);
    });

    it('tanggal tidak valid → 400; tanggal sudah ada → 409', async () => {
      const invalid = await as(adminToken)
        .post('/api/v1/holidays')
        .send({ date: '2026-02-30', name: 'X' })
        .expect(400);
      expect(invalid.body.error.details[0].field).toBe('date');
      await as(adminToken)
        .post('/api/v1/holidays')
        .send({ date: '2026-12-25', name: 'Natal' })
        .expect(409);
    });

    it('bulk: tanggal yang sudah ada dilewati, duplikat dalam payload ditolak', async () => {
      const res = await as(adminToken)
        .post('/api/v1/holidays/bulk')
        .send({
          items: [
            { date: '2026-03-20', name: 'Idul Fitri' },
            { date: '2026-03-21', name: 'Idul Fitri' },
            { date: '2026-12-25', name: 'Natal' },
          ],
        })
        .expect(201);
      expect(res.body.data).toEqual({ created: 2, skipped: 1 });

      const dup = await as(adminToken)
        .post('/api/v1/holidays/bulk')
        .send({
          items: [
            { date: '2026-05-01', name: 'Hari Buruh' },
            { date: '2026-05-01', name: 'Hari Buruh 2' },
          ],
        })
        .expect(400);
      expect(dup.body.error.details[0].field).toBe('items.1.date');
    });
  });

  describe('Settings', () => {
    it('GET /settings/public tanpa login', async () => {
      const res = await request(http).get('/api/v1/settings/public').expect(200);
      expect(res.body.data).toEqual({ companyName: expect.any(String), logoUrl: '' });
    });

    it('ADMIN boleh membaca tetapi tidak boleh mengubah', async () => {
      const res = await as(adminToken).get('/api/v1/settings').expect(200);
      expect(res.body.data['leave.annualQuota']).toBe(12);
      await as(adminToken).patch('/api/v1/settings').send({ 'leave.annualQuota': 10 }).expect(403);
    });

    it('SUPER_ADMIN: key di luar whitelist & tipe salah ditolak', async () => {
      const unknown = await as(superAdminToken)
        .patch('/api/v1/settings')
        .send({ 'hack.key': 'x' })
        .expect(400);
      expect(unknown.body.error.details[0].field).toBe('hack.key');
      const wrongType = await as(superAdminToken)
        .patch('/api/v1/settings')
        .send({ 'attendance.geofenceEnabled': 'ya' })
        .expect(400);
      expect(wrongType.body.error.details[0].field).toBe('attendance.geofenceEnabled');
    });

    it('SUPER_ADMIN mengubah settings → tersimpan, audit before/after, publik ikut berubah', async () => {
      const res = await as(superAdminToken)
        .patch('/api/v1/settings')
        .send({ 'company.name': 'PT Maju Bersama', 'leave.annualQuota': 15 })
        .expect(200);
      expect(res.body.data).toMatchObject({
        'company.name': 'PT Maju Bersama',
        'leave.annualQuota': 15,
      });

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.SETTING_UPDATED, entityId: 'leave.annualQuota' },
      });
      expect(audit).toMatchObject({ actorId: superAdminId, metadata: { before: 12, after: 15 } });

      const publicRes = await request(http).get('/api/v1/settings/public').expect(200);
      expect(publicRes.body.data.companyName).toBe('PT Maju Bersama');
    });
  });

  describe('Swagger', () => {
    it('setiap endpoint punya tag, ringkasan, dan contoh/schema respons sukses', async () => {
      const res = await request(http).get('/api/docs-json').expect(200);
      const paths = res.body.paths as Record<string, Record<string, OpenApiOperation>>;
      const problems: string[] = [];

      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          const label = `${method.toUpperCase()} ${path}`;
          if (!operation.summary) problems.push(`${label}: tanpa summary`);
          if (!operation.tags?.length) problems.push(`${label}: tanpa tag`);
          const success = Object.entries(operation.responses).find(([status]) =>
            status.startsWith('2'),
          );
          const content = success?.[1].content;
          const documented =
            content && Object.values(content).some((media) => media.schema ?? media.example);
          if (!documented) problems.push(`${label}: respons sukses tanpa contoh/schema`);
        }
      }

      expect(problems).toEqual([]);
      expect(Object.keys(paths)).toEqual(
        expect.arrayContaining([
          '/api/v1/users',
          '/api/v1/users/import',
          '/api/v1/departments',
          '/api/v1/shifts',
          '/api/v1/locations',
          '/api/v1/holidays/bulk',
          '/api/v1/settings/public',
        ]),
      );
    });
  });
});
