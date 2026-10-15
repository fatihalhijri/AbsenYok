import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Role } from '@/common/constants/roles';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { PrismaService } from '@/prisma/prisma.service';
import { createDepartment, createShift, createUser, E2E_PASSWORD } from '../factories';
import {
  createE2eApp,
  createIpSequence,
  errorFields,
  expectNoSecrets,
  loginToken,
  resetDatabase,
} from './e2e-utils';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADERS = [
  'employeeCode',
  'name',
  'email',
  'phone',
  'position',
  'departmentCode',
  'shiftName',
  'password',
];

async function buildXlsx(rows: (string | undefined)[][], headers = HEADERS): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Karyawan');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('Users (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const nextIp = createIpSequence('198.18.0');

  let superAdminToken: string;
  let adminToken: string;
  let employeeToken: string;
  const ids = { superAdmin: '', admin: '', otherAdmin: '', employee: '' };
  let departmentId: string;
  let shiftId: string;
  let inactiveShiftId: string;

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

    departmentId = (await createDepartment(prisma, { code: 'HR', name: 'Sumber Daya Manusia' })).id;
    shiftId = (await createShift(prisma)).id;
    inactiveShiftId = (
      await createShift(prisma, {
        name: 'Lama',
        startTime: '07:00',
        endTime: '15:00',
        isActive: false,
      })
    ).id;

    ids.superAdmin = (
      await createUser(prisma, {
        employeeCode: 'SA1',
        email: 'sa@e2e.test',
        role: Role.SUPER_ADMIN,
      })
    ).id;
    ids.admin = (
      await createUser(prisma, {
        employeeCode: 'ADM1',
        email: 'adm@e2e.test',
        role: Role.ADMIN,
      })
    ).id;
    ids.otherAdmin = (
      await createUser(prisma, {
        employeeCode: 'ADM2',
        email: 'adm2@e2e.test',
        role: Role.ADMIN,
      })
    ).id;
    ids.employee = (
      await createUser(prisma, {
        employeeCode: 'EMP1',
        email: 'emp@e2e.test',
        role: Role.EMPLOYEE,
        shiftId,
      })
    ).id;

    superAdminToken = await loginToken(http, 'sa@e2e.test', nextIp());
    adminToken = await loginToken(http, 'adm@e2e.test', nextIp());
    employeeToken = await loginToken(http, 'emp@e2e.test', nextIp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('hierarki role', () => {
    const newUser = (overrides: Record<string, unknown> = {}) => ({
      employeeCode: 'new-001',
      name: 'Pengguna Baru',
      email: 'Baru@E2E.test',
      password: 'Karyawan@123',
      ...overrides,
    });

    it('ADMIN membuat user role ADMIN → 403 FORBIDDEN', async () => {
      const res = await as(adminToken)
        .post('/api/v1/users')
        .send(newUser({ role: 'ADMIN', employeeCode: 'ADM9', email: 'adm9@e2e.test' }))
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(await prisma.user.count({ where: { email: 'adm9@e2e.test' } })).toBe(0);
    });

    it('SUPER_ADMIN membuat user role ADMIN → 201, respons aman', async () => {
      const res = await as(superAdminToken)
        .post('/api/v1/users')
        .send(newUser({ role: 'ADMIN', employeeCode: 'adm-9', email: 'adm9@e2e.test' }))
        .expect(201);
      expect(res.body.data).toMatchObject({
        employeeCode: 'ADM-9',
        email: 'adm9@e2e.test',
        role: 'ADMIN',
        isActive: true,
        hasBoundDevice: false,
      });
      expectNoSecrets(res.body);
      expect(res.body.data).not.toHaveProperty('failedLoginAttempts');
      expect(res.body.data).not.toHaveProperty('lockedUntil');

      const audit = await prisma.auditLog.count({
        where: {
          action: AuditAction.USER_CREATED,
          entityId: res.body.data.id,
          actorId: ids.superAdmin,
        },
      });
      expect(audit).toBe(1);
    });

    it('ADMIN membuat EMPLOYEE dengan relasi valid → 201 (email & kode dinormalisasi)', async () => {
      const res = await as(adminToken)
        .post('/api/v1/users')
        .send(newUser({ departmentId, shiftId, phone: '0812-3456 7890' }))
        .expect(201);
      expect(res.body.data).toMatchObject({
        employeeCode: 'NEW-001',
        email: 'baru@e2e.test',
        phone: '081234567890',
        role: 'EMPLOYEE',
        department: { id: departmentId, code: 'HR' },
        shift: { id: shiftId, name: 'Reguler' },
      });
    });

    it('email/kode karyawan duplikat → 409 CONFLICT dengan field', async () => {
      const res = await as(adminToken).post('/api/v1/users').send(newUser()).expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(errorFields(res.body)).toEqual(['email', 'employeeCode']);
    });

    it('shift nonaktif / departemen tidak ada → 400 VALIDATION_ERROR per field', async () => {
      const res = await as(adminToken)
        .post('/api/v1/users')
        .send(
          newUser({
            employeeCode: 'EMP77',
            email: 'emp77@e2e.test',
            shiftId: inactiveShiftId,
            departmentId: '00000000-0000-4000-8000-000000000000',
          }),
        )
        .expect(400);
      expect(errorFields(res.body)).toEqual(['departmentId', 'shiftId']);
    });

    it('edit karyawan yang shift-nya sudah nonaktif: field lain tetap bisa diubah', async () => {
      const created = await as(adminToken)
        .post('/api/v1/users')
        .send(newUser({ employeeCode: 'EMP78', email: 'emp78@e2e.test', shiftId }))
        .expect(201);
      const id = created.body.data.id as string;
      await prisma.shift.update({ where: { id: shiftId }, data: { isActive: false } });
      try {
        // Form mengirim ulang shiftId lama yang kini nonaktif → tidak boleh ditolak.
        await as(adminToken)
          .patch(`/api/v1/users/${id}`)
          .send({ phone: '081299990000', shiftId })
          .expect(200);
        // Memilih shift nonaktif yang BERBEDA tetap ditolak.
        const res = await as(adminToken)
          .patch(`/api/v1/users/${id}`)
          .send({ shiftId: inactiveShiftId })
          .expect(400);
        expect(errorFields(res.body)).toEqual(['shiftId']);
      } finally {
        await prisma.shift.update({ where: { id: shiftId }, data: { isActive: true } });
      }
    });

    it('null pada field wajib → 400 VALIDATION_ERROR (bukan 500)', async () => {
      const res = await as(adminToken)
        .patch(`/api/v1/users/${ids.employee}`)
        .send({ name: null })
        .expect(400);
      expect(errorFields(res.body)).toEqual(['name']);
    });

    it('ADMIN tidak boleh mengubah/menonaktifkan ADMIN lain; SUPER_ADMIN boleh', async () => {
      await as(adminToken)
        .patch(`/api/v1/users/${ids.otherAdmin}`)
        .send({ name: 'Ganti' })
        .expect(403);
      await as(adminToken)
        .patch(`/api/v1/users/${ids.otherAdmin}/status`)
        .send({ isActive: false })
        .expect(403);
      const res = await as(superAdminToken)
        .patch(`/api/v1/users/${ids.otherAdmin}`)
        .send({ position: 'Supervisor' })
        .expect(200);
      expect(res.body.data.position).toBe('Supervisor');
    });

    it('ADMIN tidak boleh menaikkan EMPLOYEE menjadi ADMIN', async () => {
      const res = await as(adminToken)
        .patch(`/api/v1/users/${ids.employee}`)
        .send({ role: 'ADMIN' })
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('tidak ada yang bisa menonaktifkan/menghapus dirinya sendiri', async () => {
      await as(superAdminToken)
        .patch(`/api/v1/users/${ids.superAdmin}/status`)
        .send({ isActive: false })
        .expect(403);
      await as(superAdminToken).delete(`/api/v1/users/${ids.superAdmin}`).expect(403);
      await as(superAdminToken)
        .patch(`/api/v1/users/${ids.superAdmin}`)
        .send({ role: 'EMPLOYEE' })
        .expect(403);
    });

    it('EMPLOYEE tidak bisa mengakses endpoint admin users', async () => {
      await as(employeeToken).get('/api/v1/users').expect(403);
    });
  });

  describe('daftar & detail', () => {
    it('paginasi, pencarian, filter role', async () => {
      const res = await as(adminToken)
        .get('/api/v1/users?role=EMPLOYEE&search=emp&limit=1')
        .expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].role).toBe('EMPLOYEE');
      expectNoSecrets(res.body);
    });

    it('sortBy di luar whitelist → 400', async () => {
      const res = await as(adminToken).get('/api/v1/users?sortBy=passwordHash').expect(400);
      expect(res.body.error.details[0].field).toBe('sortBy');
    });

    it('id bukan UUID → 400 field id; UUID tidak ada → 404', async () => {
      const bad = await as(adminToken).get('/api/v1/users/abc').expect(400);
      expect(bad.body.error.details).toEqual([
        { field: 'id', messages: ['ID harus berupa UUID yang valid'] },
      ]);
      await as(adminToken).get('/api/v1/users/00000000-0000-4000-8000-000000000000').expect(404);
    });
  });

  describe('status, reset device, reset password, hapus', () => {
    let targetId: string;
    let targetToken: string;

    beforeAll(async () => {
      const user = await createUser(prisma, {
        employeeCode: 'EMP-STAT',
        email: 'status@e2e.test',
        role: Role.EMPLOYEE,
      });
      targetId = user.id;
      await prisma.user.update({ where: { id: targetId }, data: { boundDeviceId: 'hp-lama' } });
      targetToken = await loginToken(http, 'status@e2e.test', nextIp());
    });

    it('reset-device → hasBoundDevice false + audit DEVICE_RESET', async () => {
      const res = await as(adminToken).post(`/api/v1/users/${targetId}/reset-device`).expect(200);
      expect(res.body.data.hasBoundDevice).toBe(false);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
      expect(user.boundDeviceId).toBeNull();
      expect(
        await prisma.auditLog.count({
          where: { action: AuditAction.DEVICE_RESET, entityId: targetId },
        }),
      ).toBe(1);
    });

    it('nonaktifkan → token dicabut, akses langsung ditolak 403 ACCOUNT_INACTIVE', async () => {
      await as(targetToken).get('/api/v1/auth/me').expect(200);
      const res = await as(adminToken)
        .patch(`/api/v1/users/${targetId}/status`)
        .send({ isActive: false })
        .expect(200);
      expect(res.body.data.isActive).toBe(false);

      expect(
        await prisma.refreshToken.count({ where: { userId: targetId, revokedAt: null } }),
      ).toBe(0);
      const denied = await as(targetToken).get('/api/v1/auth/me').expect(403);
      expect(denied.body.error.code).toBe('ACCOUNT_INACTIVE');

      await as(adminToken)
        .patch(`/api/v1/users/${targetId}/status`)
        .send({ isActive: true })
        .expect(200);
    });

    it('reset-password → password lama tidak berlaku, password baru bisa login', async () => {
      await as(adminToken)
        .post(`/api/v1/users/${targetId}/reset-password`)
        .send({ newPassword: 'ResetBaru123' })
        .expect(200);
      await request(http)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', nextIp())
        .send({ email: 'status@e2e.test', password: E2E_PASSWORD })
        .expect(401);
      await loginToken(http, 'status@e2e.test', nextIp(), 'ResetBaru123');
    });

    it('DELETE oleh ADMIN → 403; oleh SUPER_ADMIN → soft delete', async () => {
      await as(adminToken).delete(`/api/v1/users/${targetId}`).expect(403);
      await as(superAdminToken).delete(`/api/v1/users/${targetId}`).expect(200);

      await as(adminToken).get(`/api/v1/users/${targetId}`).expect(404);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
      expect(row.deletedAt).not.toBeNull();
      expect(row.isActive).toBe(false);

      // Email akun terhapus tidak bisa dipakai ulang (constraint unik), pesannya jelas.
      const res = await as(adminToken)
        .post('/api/v1/users')
        .send({
          employeeCode: 'EMP-X',
          name: 'Baru',
          email: 'status@e2e.test',
          password: 'Karyawan@123',
        })
        .expect(409);
      expect(res.body.error.details[0].messages[0]).toContain('akun yang sudah dihapus');
    });
  });

  describe('profil sendiri', () => {
    it('PATCH /users/me mengubah nama & telepon, mengembalikan UserProfile', async () => {
      const res = await as(employeeToken)
        .patch('/api/v1/users/me')
        .send({ name: 'Nama Baru', phone: '+6281234567890' })
        .expect(200);
      expect(res.body.data).toMatchObject({
        id: ids.employee,
        name: 'Nama Baru',
        phone: '+6281234567890',
      });
      expectNoSecrets(res.body);
    });

    it('PATCH /users/me menolak field lain (mis. role)', async () => {
      await as(employeeToken).patch('/api/v1/users/me').send({ role: 'ADMIN' }).expect(400);
    });
  });

  describe('avatar', () => {
    it('file .exe yang di-rename .jpg → 400 VALIDATION_ERROR', async () => {
      const fakeJpg = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(512, 0x90)]);
      const res = await as(employeeToken)
        .post('/api/v1/users/me/avatar')
        .attach('file', fakeJpg, { filename: 'foto.jpg', contentType: 'image/jpeg' })
        .expect(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'file', messages: ['File harus berupa gambar JPG, PNG, atau WEBP'] }],
      });
    });

    it('tanpa file → 400', async () => {
      const res = await as(employeeToken).post('/api/v1/users/me/avatar').expect(400);
      expect(res.body.error.details[0].field).toBe('file');
    });

    it('PNG valid → disimpan 256×256 WEBP dan disajikan statis dengan Cache-Control', async () => {
      const png = await sharp({
        create: { width: 800, height: 600, channels: 3, background: '#336699' },
      })
        .png()
        .toBuffer();

      const first = await as(employeeToken)
        .post('/api/v1/users/me/avatar')
        .attach('file', png, { filename: 'foto.png', contentType: 'image/png' })
        .expect(200);
      const firstUrl = first.body.data.avatarUrl as string;
      expect(firstUrl).toMatch(/^\/uploads\/avatars\/[0-9a-f-]{36}\.webp$/);

      const image = await request(http).get(firstUrl).buffer(true).expect(200);
      expect(image.headers['content-type']).toBe('image/webp');
      expect(image.headers['cache-control']).toContain('max-age=604800');
      expect(image.headers['cache-control']).toContain('immutable');
      const meta = await sharp(image.body as Buffer).metadata();
      expect({ width: meta.width, height: meta.height, format: meta.format }).toEqual({
        width: 256,
        height: 256,
        format: 'webp',
      });

      // Ganti avatar → file lama dihapus.
      const second = await as(employeeToken)
        .post('/api/v1/users/me/avatar')
        .attach('file', png, { filename: 'foto2.png', contentType: 'image/png' })
        .expect(200);
      expect(second.body.data.avatarUrl).not.toBe(firstUrl);
      await request(http).get(firstUrl).expect(404);
    });
  });

  describe('import XLSX', () => {
    it('template bisa diunduh dan berisi header lengkap', async () => {
      const res = await as(adminToken)
        .get('/api/v1/users/import/template')
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toContain(XLSX_MIME);
      expect(res.headers['content-disposition']).toContain('template-import-karyawan.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as ArrayBuffer);
      const header = (workbook.getWorksheet('Karyawan')?.getRow(1).values as string[]).filter(
        Boolean,
      );
      expect(header).toEqual(HEADERS);
      expect(workbook.getWorksheet('Referensi')).toBeDefined();
    });

    it('1 baris email duplikat → tidak ada data tersimpan, error menyebut nomor baris', async () => {
      const before = await prisma.user.count();
      const file = await buildXlsx([
        [
          'IMP001',
          'Andi Wijaya',
          'andi@e2e.test',
          '081111111111',
          'Staf',
          'HR',
          'Reguler',
          'Karyawan@123',
        ],
        ['IMP002', 'Budi Hartono', 'andi@e2e.test', '', '', '', '', 'Karyawan@123'],
        ['IMP003', 'Citra Lestari', 'citra@e2e.test', '', '', 'hr', 'reguler', 'Karyawan@123'],
      ]);

      const res = await as(adminToken)
        .post('/api/v1/users/import')
        .attach('file', file, { filename: 'karyawan.xlsx', contentType: XLSX_MIME })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('1 baris tidak valid; tidak ada data yang disimpan');
      expect(res.body.error.details).toEqual([
        { row: 3, field: 'email', messages: ['Email duplikat dengan baris 2'] },
      ]);
      expect(await prisma.user.count()).toBe(before);
    });

    it('error format, referensi, dan bentrok database dilaporkan per baris', async () => {
      const file = await buildXlsx([
        ['IMP010', 'X', 'bukan-email', '', '', 'TIDAKADA', 'Lama', 'lemah'],
        ['EMP1', 'Duplikat DB', 'emp@e2e.test', '', '', '', '', 'Karyawan@123'],
      ]);
      const res = await as(adminToken)
        .post('/api/v1/users/import')
        .attach('file', file, { filename: 'karyawan.xlsx', contentType: XLSX_MIME })
        .expect(400);

      const byRow = (row: number) =>
        (res.body.error.details as { row: number; field: string }[])
          .filter((d) => d.row === row)
          .map((d) => d.field)
          .sort();
      expect(byRow(2)).toEqual(['departmentCode', 'email', 'name', 'password', 'shiftName']);
      expect(byRow(3)).toEqual(['email', 'employeeCode']);
    });

    it('semua baris valid → tersimpan dalam satu transaksi + audit per user', async () => {
      const file = await buildXlsx([
        [
          'IMP101',
          'Dewi Anggraini',
          'dewi@e2e.test',
          '081222333444',
          'Staf HR',
          'HR',
          'Reguler',
          'Karyawan@123',
        ],
        ['IMP102', 'Eko Prasetyo', 'eko@e2e.test', '', '', '', '', 'Karyawan@123'],
      ]);
      const res = await as(adminToken)
        .post('/api/v1/users/import')
        .attach('file', file, { filename: 'karyawan.xlsx', contentType: XLSX_MIME })
        .expect(201);
      expect(res.body.data).toEqual({ imported: 2 });

      const dewi = await prisma.user.findUniqueOrThrow({ where: { email: 'dewi@e2e.test' } });
      expect(dewi).toMatchObject({
        role: 'EMPLOYEE',
        departmentId,
        shiftId,
        phone: '081222333444',
      });
      expect(dewi.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(
        await prisma.auditLog.count({
          where: { action: AuditAction.USER_CREATED, entityId: dewi.id },
        }),
      ).toBe(1);
      await loginToken(http, 'dewi@e2e.test', nextIp(), 'Karyawan@123');
    });

    it('header tidak sesuai → error baris 1', async () => {
      const file = await buildXlsx([['A', 'B']], ['kode', 'nama']);
      const res = await as(adminToken)
        .post('/api/v1/users/import')
        .attach('file', file, { filename: 'karyawan.xlsx', contentType: XLSX_MIME })
        .expect(400);
      const details = res.body.error.details as { row: number }[];
      expect(details.every((detail) => detail.row === 1)).toBe(true);
    });

    it('file bukan XLSX (CSV di-rename) → 400', async () => {
      const res = await as(adminToken)
        .post('/api/v1/users/import')
        .attach('file', Buffer.from('employeeCode,name\nX,Y'), {
          filename: 'data.xlsx',
          contentType: XLSX_MIME,
        })
        .expect(400);
      expect(res.body.error.details[0]).toEqual({
        field: 'file',
        messages: ['File harus berformat Excel .xlsx'],
      });
    });

    it('EMPLOYEE tidak bisa import', async () => {
      await as(employeeToken).get('/api/v1/users/import/template').expect(403);
    });
  });
});
