import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ClockService } from '@/common/clock/clock.service';
import { Role } from '@/common/constants/roles';
import { toDbDate } from '@/common/utils/date.util';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { SettingsService } from '@/modules/settings/settings.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createE2eApp,
  createIpSequence,
  createUserFixture,
  errorFields,
  FakeClock,
  loginToken,
  resetDatabase,
} from './e2e-utils';

/** "Hari ini" = Rabu 21 Okt 2026; Jumat 23 Okt = hari libur. */
const TODAY = '2026-10-21';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n');
const FAKE_PDF = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(256, 0x90)]);

describe('Leave requests (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const clock = new FakeClock();
  const nextIp = createIpSequence('198.23.0');

  let adminToken: string;
  let employeeA: string;
  let employeeB: string;
  let noShiftToken: string;
  const ids = { a: '', b: '', admin: '' };

  const as = (token: string) => ({
    get: (url: string) => request(http).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(http).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(http).patch(url).set('Authorization', `Bearer ${token}`),
  });

  /** Kirim pengajuan multipart. */
  function submit(
    token: string,
    fields: Record<string, string>,
    file?: { buffer: Buffer; filename: string; contentType: string },
  ) {
    const req = as(token).post('/api/v1/leave-requests');
    for (const [key, value] of Object.entries(fields)) req.field(key, value);
    if (file)
      req.attach('attachment', file.buffer, {
        filename: file.filename,
        contentType: file.contentType,
      });
    return req;
  }

  beforeAll(async () => {
    clock.set(`${TODAY}T10:00:00+07:00`);
    app = await createE2eApp([], (builder) =>
      builder.overrideProvider(ClockService).useValue(clock),
    );
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    app.get(SettingsService).invalidate();

    const shiftId = (
      await prisma.shift.create({ data: { name: 'Reguler', startTime: '08:00', endTime: '17:00' } })
    ).id;
    await prisma.holiday.create({ data: { date: toDbDate('2026-10-23'), name: 'Libur Uji' } });

    ids.admin = (
      await createUserFixture(prisma, {
        employeeCode: 'ADM',
        email: 'adm@lv.test',
        role: Role.ADMIN,
      })
    ).id;
    ids.a = (
      await createUserFixture(prisma, {
        employeeCode: 'EMP-A',
        email: 'a@lv.test',
        role: Role.EMPLOYEE,
        shiftId,
      })
    ).id;
    ids.b = (
      await createUserFixture(prisma, {
        employeeCode: 'EMP-B',
        email: 'b@lv.test',
        role: Role.EMPLOYEE,
        shiftId,
      })
    ).id;
    await createUserFixture(prisma, {
      employeeCode: 'EMP-N',
      email: 'n@lv.test',
      role: Role.EMPLOYEE,
    });

    adminToken = await loginToken(http, 'adm@lv.test', nextIp());
    employeeA = await loginToken(http, 'a@lv.test', nextIp());
    employeeB = await loginToken(http, 'b@lv.test', nextIp());
    noShiftToken = await loginToken(http, 'n@lv.test', nextIp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('pengajuan', () => {
    let annualId: string;

    it('cuti Kamis–Selasa → totalDays 3 (Jumat libur, akhir pekan dilewati)', async () => {
      const res = await submit(employeeA, {
        type: 'ANNUAL',
        startDate: '2026-10-22',
        endDate: '2026-10-27',
        reason: 'Acara keluarga di luar kota',
      }).expect(201);
      annualId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        type: 'ANNUAL',
        status: 'PENDING',
        totalDays: 3,
        startDate: '2026-10-22',
        endDate: '2026-10-27',
        hasAttachment: false,
        attachmentUrl: null,
        user: { employeeCode: 'EMP-A' },
        reviewedBy: null,
      });
    });

    it('pengajuan tumpang tindih dengan PENDING ditolak (409)', async () => {
      const res = await submit(employeeA, {
        type: 'PERMIT',
        startDate: '2026-10-27',
        endDate: '2026-10-28',
        reason: 'Mengurus dokumen',
      }).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'CONFLICT',
        message: 'Tanggal bertabrakan dengan pengajuan lain',
      });
      expect(res.body.error.details[0].messages[0]).toContain(annualId);
    });

    it.each([
      [
        'tanggal selesai sebelum mulai',
        { startDate: '2026-10-28', endDate: '2026-10-26' },
        'endDate',
      ],
      [
        'mulai lebih dari 7 hari ke belakang',
        { startDate: '2026-10-13', endDate: '2026-10-13' },
        'startDate',
      ],
      ['rentang melebihi 14 hari', { startDate: '2026-11-02', endDate: '2026-11-20' }, 'endDate'],
      ['hanya akhir pekan', { startDate: '2026-10-31', endDate: '2026-11-01' }, 'startDate'],
      ['tanggal tidak valid', { startDate: '2026-02-30', endDate: '2026-03-01' }, 'startDate'],
    ])('%s → 400', async (_label, dates, field) => {
      const res = await submit(employeeB, {
        type: 'PERMIT',
        reason: 'Keperluan pribadi',
        ...dates,
      }).expect(400);
      expect(errorFields(res.body)).toContain(field);
    });

    it('cuti tahunan lintas tahun ditolak (ajukan per tahun)', async () => {
      clock.set('2026-12-28T10:00:00+07:00');
      const res = await submit(employeeB, {
        type: 'ANNUAL',
        startDate: '2026-12-30',
        endDate: '2027-01-04',
        reason: 'Libur akhir tahun',
      }).expect(400);
      expect(errorFields(res.body)).toEqual(['endDate']);
      clock.set(`${TODAY}T10:00:00+07:00`);
    });

    it('karyawan tanpa shift → 422 NO_SHIFT_ASSIGNED', async () => {
      const res = await submit(noShiftToken, {
        type: 'PERMIT',
        startDate: '2026-10-22',
        endDate: '2026-10-22',
        reason: 'Keperluan pribadi',
      }).expect(422);
      expect(res.body.error.code).toBe('NO_SHIFT_ASSIGNED');
    });

    it('ADMIN tidak mengajukan lewat endpoint karyawan', async () => {
      await submit(adminToken, {
        type: 'PERMIT',
        startDate: '2026-10-22',
        endDate: '2026-10-22',
        reason: 'Uji',
      }).expect(403);
    });
  });

  describe('lampiran', () => {
    let sickId: string;

    it('SAKIT > 1 hari tanpa surat dokter → 400 field attachment', async () => {
      const res = await submit(employeeB, {
        type: 'SICK',
        startDate: '2026-10-19',
        endDate: '2026-10-20',
        reason: 'Demam tinggi',
      }).expect(400);
      expect(res.body.error.details).toEqual([
        {
          field: 'attachment',
          messages: ['Sakit lebih dari 1 hari wajib melampirkan surat dokter'],
        },
      ]);
    });

    it('file .exe yang di-rename .pdf ditolak (cek magic bytes)', async () => {
      const res = await submit(
        employeeB,
        { type: 'SICK', startDate: '2026-10-19', endDate: '2026-10-20', reason: 'Demam tinggi' },
        { buffer: FAKE_PDF, filename: 'surat.pdf', contentType: 'application/pdf' },
      ).expect(400);
      expect(errorFields(res.body)).toEqual(['attachment']);
    });

    it('PDF valid → tersimpan, URL lampiran menunjuk endpoint terproteksi', async () => {
      const res = await submit(
        employeeB,
        { type: 'SICK', startDate: '2026-10-19', endDate: '2026-10-20', reason: 'Demam tinggi' },
        { buffer: PDF, filename: 'surat-dokter.pdf', contentType: 'application/pdf' },
      ).expect(201);
      sickId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        hasAttachment: true,
        attachmentUrl: `/api/v1/leave-requests/${sickId}/attachment`,
        totalDays: 2,
      });

      const row = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: sickId } });
      expect(row.attachmentUrl).toMatch(/^leave\/[0-9a-f-]{36}\.pdf$/);
    });

    it('pemilik & admin bisa mengunduh; karyawan lain 403', async () => {
      const owner = await as(employeeB)
        .get(`/api/v1/leave-requests/${sickId}/attachment`)
        .buffer(true)
        .expect(200);
      expect(owner.headers['content-type']).toBe('application/pdf');
      expect(owner.headers['cache-control']).toBe('private, no-store');
      expect(owner.headers['content-disposition']).toContain('inline');
      expect(Buffer.from(owner.body as Buffer).equals(PDF)).toBe(true);

      await as(adminToken).get(`/api/v1/leave-requests/${sickId}/attachment`).expect(200);

      const other = await as(employeeA)
        .get(`/api/v1/leave-requests/${sickId}/attachment`)
        .expect(403);
      expect(other.body.error.code).toBe('FORBIDDEN');
      await as(employeeA).get(`/api/v1/leave-requests/${sickId}`).expect(403);
    });

    it('folder lampiran tidak bisa diakses statis', async () => {
      const row = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: sickId } });
      await request(http).get(`/uploads/${row.attachmentUrl}`).expect(404);
      await request(http).get(`/uploads/avatars/../${row.attachmentUrl}`).expect(404);
    });

    it('pengajuan tanpa lampiran → 404 saat diunduh', async () => {
      const mine = await as(employeeA).get('/api/v1/leave-requests/me').expect(200);
      await as(employeeA)
        .get(`/api/v1/leave-requests/${mine.body.data[0].id}/attachment`)
        .expect(404);
    });
  });

  describe('kuota cuti tahunan', () => {
    it('GET /me/quota: used dari APPROVED, pending terpisah', async () => {
      const res = await as(employeeA).get('/api/v1/leave-requests/me/quota').expect(200);
      expect(res.body.data).toEqual({ year: 2026, quota: 12, used: 0, pending: 3, remaining: 12 });
    });

    it('kuota tidak cukup (termasuk yang menunggu) → 400', async () => {
      await prisma.setting.create({ data: { key: 'leave.annualQuota', value: '4' } });
      app.get(SettingsService).invalidate();

      const res = await submit(employeeA, {
        type: 'ANNUAL',
        startDate: '2026-11-02',
        endDate: '2026-11-03',
        reason: 'Cuti tambahan',
      }).expect(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'type' });
      expect(res.body.error.details[0].messages[0]).toContain('tersedia 1 hari');

      await prisma.setting.delete({ where: { key: 'leave.annualQuota' } });
      app.get(SettingsService).invalidate();
    });
  });

  describe('approve & reject', () => {
    let pastLeaveId: string;

    it('approve cuti untuk tanggal yang sudah ABSENT → berubah menjadi LEAVE', async () => {
      await prisma.attendance.createMany({
        data: [
          { userId: ids.a, date: toDbDate('2026-10-19'), status: 'ABSENT' },
          { userId: ids.a, date: toDbDate('2026-10-20'), status: 'ABSENT' },
        ],
      });
      const created = await submit(employeeA, {
        type: 'ANNUAL',
        startDate: '2026-10-19',
        endDate: '2026-10-20',
        reason: 'Cuti mendadak karena keluarga sakit',
      }).expect(201);
      pastLeaveId = created.body.data.id;

      const res = await as(adminToken)
        .patch(`/api/v1/leave-requests/${pastLeaveId}/approve`)
        .send({ note: 'Disetujui' })
        .expect(200);
      expect(res.body.data).toMatchObject({
        status: 'APPROVED',
        reviewNote: 'Disetujui',
        reviewedBy: { id: ids.admin, name: 'User ADM' },
      });
      expect(res.body.data.reviewedAt).toEqual(expect.any(String));

      const records = await prisma.attendance.findMany({
        where: { userId: ids.a },
        orderBy: { date: 'asc' },
      });
      expect(records.map((r) => [r.status, r.leaveRequestId])).toEqual([
        ['LEAVE', pastLeaveId],
        ['LEAVE', pastLeaveId],
      ]);

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.LEAVE_APPROVED, entityId: pastLeaveId },
      });
      expect(audit.metadata).toMatchObject({ convertedAttendances: 2, totalDays: 2 });

      const quota = await as(employeeA).get('/api/v1/leave-requests/me/quota').expect(200);
      expect(quota.body.data).toMatchObject({ used: 2, pending: 3, remaining: 10 });
    });

    it('approve/reject ulang (bukan PENDING) → 409', async () => {
      await as(adminToken)
        .patch(`/api/v1/leave-requests/${pastLeaveId}/approve`)
        .send({})
        .expect(409);
      await as(adminToken)
        .patch(`/api/v1/leave-requests/${pastLeaveId}/reject`)
        .send({ note: 'Coba tolak' })
        .expect(409);
    });

    it('reject wajib note; berhasil → REJECTED + audit', async () => {
      const pending = await as(adminToken)
        .get('/api/v1/leave-requests?status=PENDING&type=ANNUAL&search=EMP-A')
        .expect(200);
      expect(pending.body.meta.total).toBe(1);
      const id = pending.body.data[0].id as string;

      const missing = await as(adminToken)
        .patch(`/api/v1/leave-requests/${id}/reject`)
        .send({})
        .expect(400);
      expect(errorFields(missing.body)).toEqual(['note']);

      const res = await as(adminToken)
        .patch(`/api/v1/leave-requests/${id}/reject`)
        .send({ note: 'Bertepatan dengan audit tahunan' })
        .expect(200);
      expect(res.body.data).toMatchObject({
        status: 'REJECTED',
        reviewNote: 'Bertepatan dengan audit tahunan',
      });
      expect(
        await prisma.auditLog.count({
          where: { action: AuditAction.LEAVE_REJECTED, entityId: id },
        }),
      ).toBe(1);
    });

    it('EMPLOYEE tidak boleh approve', async () => {
      await as(employeeB)
        .patch(`/api/v1/leave-requests/${pastLeaveId}/approve`)
        .send({})
        .expect(403);
    });
  });

  describe('pembatalan', () => {
    let permitId: string;

    beforeAll(async () => {
      const res = await submit(employeeB, {
        type: 'PERMIT',
        startDate: '2026-10-28',
        endDate: '2026-10-28',
        reason: 'Mengurus SIM',
      }).expect(201);
      permitId = res.body.data.id;
    });

    it('karyawan lain tidak bisa membatalkan → 403', async () => {
      await as(employeeA).patch(`/api/v1/leave-requests/${permitId}/cancel`).expect(403);
    });

    it('pemilik membatalkan PENDING → CANCELLED; dibatalkan lagi → 409', async () => {
      const res = await as(employeeB)
        .patch(`/api/v1/leave-requests/${permitId}/cancel`)
        .expect(200);
      expect(res.body.data.status).toBe('CANCELLED');
      await as(employeeB).patch(`/api/v1/leave-requests/${permitId}/cancel`).expect(409);
    });

    it('tanggal pengajuan yang dibatalkan bisa diajukan ulang', async () => {
      await submit(employeeB, {
        type: 'PERMIT',
        startDate: '2026-10-28',
        endDate: '2026-10-28',
        reason: 'Mengurus SIM (jadwal ulang)',
      }).expect(201);
    });
  });

  describe('daftar', () => {
    it('GET /me: pengajuan sendiri per tahun, filter status', async () => {
      const res = await as(employeeB).get('/api/v1/leave-requests/me?status=CANCELLED').expect(200);
      const leaves = res.body.data as { user: { id: string } }[];
      expect(leaves).toHaveLength(1);
      expect(leaves.every((leave) => leave.user.id === ids.b)).toBe(true);
    });

    it('admin: paginasi + filter rentang beririsan + user ringkas & reviewer', async () => {
      const res = await as(adminToken)
        .get(
          '/api/v1/leave-requests?dateFrom=2026-10-20&dateTo=2026-10-20&sortBy=startDate&sortOrder=asc',
        )
        .expect(200);
      // Beririsan dengan 20 Okt: cuti A 19–20 (APPROVED) & sakit B 19–20.
      expect(
        (res.body.data as { user: { employeeCode: string } }[])
          .map((l) => l.user.employeeCode)
          .sort(),
      ).toEqual(['EMP-A', 'EMP-B']);
      expect(res.body.meta).toMatchObject({ page: 1, total: 2 });
    });

    it('EMPLOYEE tidak bisa membuka daftar admin', async () => {
      await as(employeeA).get('/api/v1/leave-requests').expect(403);
    });
  });
});
