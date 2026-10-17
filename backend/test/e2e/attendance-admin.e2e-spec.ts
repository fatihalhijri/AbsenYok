import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ClockService } from '@/common/clock/clock.service';
import { Role } from '@/common/constants/roles';
import { toDbDate } from '@/common/utils/date.util';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { DAILY_CRON_LOCK } from '@/modules/attendance/attendance-recalculate.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createAttendance,
  createHoliday,
  createLeaveRequest,
  createShift,
  createUser,
} from '../factories';
import {
  createE2eApp,
  createIpSequence,
  errorFields,
  FakeClock,
  loginToken,
  resetDatabase,
} from './e2e-utils';

/** Minggu uji: Senin 19 – Minggu 25 Okt 2026 (Selasa = hari libur). */
const MON = '2026-10-19';
const TUE = '2026-10-20';
const WED = '2026-10-21';
const THU = '2026-10-22';
const FRI = '2026-10-23';
const SAT = '2026-10-24';
const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const SNAPSHOT = {
  name: 'Reguler',
  startTime: '08:00',
  endTime: '17:00',
  lateToleranceMinutes: 15,
};

type Person =
  'present' | 'absentee' | 'onLeave' | 'lateLeave' | 'inactive' | 'noShift' | 'newcomer';

describe('Attendance admin & recalculate (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const clock = new FakeClock();
  const nextIp = createIpSequence('198.22.0');

  let superAdminToken: string;
  let adminToken: string;
  let presentToken: string;
  let superAdminId: string;
  let presentMondayId: string;
  const ids = {} as Record<Person, string>;

  const as = (token: string) => ({
    get: (url: string) => request(http).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(http).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(http).patch(url).set('Authorization', `Bearer ${token}`),
  });

  const recordOf = (person: Person, date: string) =>
    prisma.attendance.findUnique({
      where: { userId_date: { userId: ids[person], date: toDbDate(date) } },
    });

  beforeAll(async () => {
    clock.set(wib(FRI, '12:00:00'));
    app = await createE2eApp([], (builder) =>
      builder.overrideProvider(ClockService).useValue(clock),
    );
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const shiftId = (await createShift(prisma)).id;
    await createHoliday(prisma, TUE);

    superAdminId = (
      await createUser(prisma, {
        employeeCode: 'SA',
        email: 'sa@adm.test',
        role: Role.SUPER_ADMIN,
      })
    ).id;
    await createUser(prisma, {
      employeeCode: 'ADM',
      email: 'adm@adm.test',
      role: Role.ADMIN,
    });

    const people: Person[] = [
      'present',
      'absentee',
      'onLeave',
      'lateLeave',
      'inactive',
      'noShift',
      'newcomer',
    ];
    for (const person of people) {
      ids[person] = (
        await createUser(prisma, {
          employeeCode: `P-${person.toUpperCase()}`,
          email: `${person.toLowerCase()}@adm.test`,
          role: Role.EMPLOYEE,
          shiftId: person === 'noShift' ? undefined : shiftId,
          isActive: person !== 'inactive',
        })
      ).id;
    }
    // Baru bergabung Rabu → tidak boleh ditandai ABSENT untuk Senin.
    await prisma.user.update({
      where: { id: ids.newcomer },
      data: { createdAt: new Date(wib(WED, '09:00:00')) },
    });
    // Akun lain dibuat sebelum minggu uji.
    await prisma.user.updateMany({
      where: { id: { not: ids.newcomer } },
      data: { createdAt: new Date(wib('2026-10-01', '09:00:00')) },
    });

    presentMondayId = (
      await createAttendance(prisma, {
        userId: ids.present,
        date: MON,
        status: 'PRESENT',
        checkInAt: new Date(wib(MON, '07:50:00')),
        checkOutAt: new Date(wib(MON, '17:05:00')),
        checkInMethod: 'KIOSK_QR',
        checkOutMethod: 'KIOSK_QR',
        workMinutes: 555,
        shiftSnapshot: SNAPSHOT,
      })
    ).id;
    await prisma.attendanceScanLog.createMany({
      data: [
        {
          userId: ids.present,
          scanType: 'KIOSK',
          success: false,
          errorCode: 'OUTSIDE_GEOFENCE',
          distance: 245,
          createdAt: new Date(wib(MON, '07:49:00')),
        },
        {
          userId: ids.present,
          scanType: 'KIOSK',
          success: true,
          distance: 20,
          createdAt: new Date(wib(MON, '07:50:00')),
        },
        {
          userId: ids.present,
          scanType: 'KIOSK',
          success: true,
          distance: 15,
          createdAt: new Date(wib(MON, '17:05:00')),
        },
        {
          userId: ids.absentee,
          scanType: 'KIOSK',
          success: false,
          errorCode: 'QR_EXPIRED',
          createdAt: new Date(wib(WED, '08:00:00')),
        },
      ],
    });

    await createLeaveRequest(prisma, {
      userId: ids.onLeave,
      type: 'ANNUAL',
      startDate: MON,
      endDate: WED,
      totalDays: 2,
      reason: 'Cuti keluarga',
    });
    // Sudah ditandai ABSENT, lalu izin sakit disetujui belakangan (§9).
    await createAttendance(prisma, { userId: ids.lateLeave, date: MON });
    await createLeaveRequest(prisma, { userId: ids.lateLeave, startDate: MON });

    superAdminToken = await loginToken(http, 'sa@adm.test', nextIp());
    adminToken = await loginToken(http, 'adm@adm.test', nextIp());
    presentToken = await loginToken(http, 'present@adm.test', nextIp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /attendance/recalculate', () => {
    it('hanya SUPER_ADMIN; tanggal masa depan ditolak', async () => {
      await as(adminToken).post(`/api/v1/attendance/recalculate?date=${MON}`).expect(403);
      const future = await as(superAdminToken)
        .post(`/api/v1/attendance/recalculate?date=${SAT}`)
        .expect(400);
      expect(errorFields(future.body)).toEqual(['date']);
    });

    it('ABSENT untuk yang tidak hadir, LEAVE (bukan ABSENT) untuk cuti disetujui, ABSENT → SICK', async () => {
      const res = await as(superAdminToken)
        .post(`/api/v1/attendance/recalculate?date=${MON}`)
        .expect(200);
      expect(res.body.data).toMatchObject({
        date: MON,
        processed: 4,
        created: 2,
        updated: 1,
        skipped: null,
      });

      expect(await recordOf('absentee', MON)).toMatchObject({
        status: 'ABSENT',
        checkInAt: null,
        shiftSnapshot: SNAPSHOT,
      });
      const leave = await recordOf('onLeave', MON);
      expect(leave).toMatchObject({ status: 'LEAVE' });
      expect(leave?.leaveRequestId).toEqual(expect.any(String));
      expect(await recordOf('lateLeave', MON)).toMatchObject({ status: 'SICK' });
      expect(await recordOf('present', MON)).toMatchObject({
        status: 'PRESENT',
        checkInMethod: 'KIOSK_QR',
      });

      // Tidak aktif, tanpa shift, dan karyawan baru (bergabung Rabu) dilewati.
      expect(await recordOf('inactive', MON)).toBeNull();
      expect(await recordOf('noShift', MON)).toBeNull();
      expect(await recordOf('newcomer', MON)).toBeNull();
    });

    it('dijalankan dua kali untuk tanggal sama → tidak ada duplikat', async () => {
      const before = await prisma.attendance.count();
      const res = await as(superAdminToken)
        .post(`/api/v1/attendance/recalculate?date=${MON}`)
        .expect(200);
      expect(res.body.data).toMatchObject({ processed: 4, created: 0, updated: 0 });
      expect(await prisma.attendance.count()).toBe(before);
    });

    it('hari libur dilewati seluruhnya', async () => {
      const res = await as(superAdminToken)
        .post(`/api/v1/attendance/recalculate?date=${TUE}`)
        .expect(200);
      expect(res.body.data).toMatchObject({
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 'HOLIDAY',
      });
      expect(await prisma.attendance.count({ where: { date: toDbDate(TUE) } })).toBe(0);
    });

    it('akhir pekan dilewati (shift Sen–Jum); karyawan baru ikut diproses sejak bergabung', async () => {
      clock.set(wib('2026-10-25', '10:00:00'));
      const saturday = await as(superAdminToken)
        .post(`/api/v1/attendance/recalculate?date=${SAT}`)
        .expect(200);
      expect(saturday.body.data).toMatchObject({ processed: 0, created: 0, skipped: null });

      const wednesday = await as(superAdminToken)
        .post(`/api/v1/attendance/recalculate?date=${WED}`)
        .expect(200);
      // present, absentee, lateLeave, newcomer → ABSENT; onLeave → LEAVE.
      expect(wednesday.body.data).toMatchObject({ processed: 5, created: 5 });
      expect(await recordOf('newcomer', WED)).toMatchObject({ status: 'ABSENT' });
      expect(await recordOf('onLeave', WED)).toMatchObject({ status: 'LEAVE' });
      clock.set(wib(FRI, '12:00:00'));
    });

    it('lock dipegang proses lain → 409 CONFLICT (cegah eksekusi ganda)', async () => {
      let release!: () => void;
      let locked!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const acquired = new Promise<void>((resolve) => (locked = resolve));

      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT GET_LOCK(${DAILY_CRON_LOCK}, 0)`;
          locked();
          await gate;
          await tx.$queryRaw`SELECT RELEASE_LOCK(${DAILY_CRON_LOCK})`;
        },
        { timeout: 30_000 },
      );
      await acquired;

      const res = await as(superAdminToken)
        .post(`/api/v1/attendance/recalculate?date=${MON}`)
        .expect(409);
      expect(res.body.error.message).toContain('sedang berjalan');

      release();
      await holder;
      await as(superAdminToken).post(`/api/v1/attendance/recalculate?date=${MON}`).expect(200);
    });
  });

  describe('POST /attendance/manual', () => {
    let manualId: string;

    it('membuat record MANUAL + metrik dihitung + audit ATTENDANCE_MANUAL_CREATED', async () => {
      const res = await as(adminToken)
        .post('/api/v1/attendance/manual')
        .send({
          userId: ids.absentee,
          date: THU,
          status: 'LATE',
          checkInAt: wib(THU, '08:20:00'),
          checkOutAt: wib(THU, '17:00:00'),
          reason: 'Lupa absen karena HP tertinggal',
        })
        .expect(201);
      manualId = res.body.data.id;

      expect(res.body.data).toMatchObject({
        date: THU,
        status: 'LATE',
        lateMinutes: 20,
        earlyLeaveMinutes: 0,
        workMinutes: 520,
        checkInMethod: 'MANUAL',
        checkOutMethod: 'MANUAL',
        note: 'Lupa absen karena HP tertinggal',
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.ATTENDANCE_MANUAL_CREATED, entityId: manualId },
      });
      expect(audit.metadata).toMatchObject({
        date: THU,
        reason: 'Lupa absen karena HP tertinggal',
      });
    });

    it('record tanggal itu sudah ada → 409 (arahkan ke PATCH)', async () => {
      const res = await as(adminToken)
        .post('/api/v1/attendance/manual')
        .send({
          userId: ids.absentee,
          date: THU,
          status: 'ABSENT',
          reason: 'Duplikat untuk uji coba',
        })
        .expect(409);
      expect(res.body.error.message).toContain('PATCH');
    });

    it.each([
      ['tanggal masa depan', { date: SAT, status: 'ABSENT' }, 'date'],
      [
        'jam masuk di tanggal lain',
        { status: 'PRESENT', checkInAt: wib(THU, '08:00:00') },
        'checkInAt',
      ],
      ['PRESENT tanpa jam masuk', { status: 'PRESENT' }, 'checkInAt'],
      ['ABSENT dengan jam', { status: 'ABSENT', checkInAt: wib(WED, '08:00:00') }, 'checkInAt'],
      [
        'pulang sebelum masuk',
        { status: 'PRESENT', checkInAt: wib(WED, '09:00:00'), checkOutAt: wib(WED, '08:00:00') },
        'checkOutAt',
      ],
      ['jam tanpa zona waktu', { status: 'PRESENT', checkInAt: `${WED}T08:00:00` }, 'checkInAt'],
      ['alasan terlalu pendek', { status: 'ABSENT', reason: 'lupa' }, 'reason'],
    ])('%s → 400', async (_label, overrides, field) => {
      const res = await as(adminToken)
        .post('/api/v1/attendance/manual')
        .send({
          userId: ids.present,
          date: WED,
          reason: 'Alasan cukup panjang untuk uji',
          ...overrides,
        })
        .expect(400);
      expect(errorFields(res.body)).toContain(field);
    });

    it('ADMIN tidak boleh membuat absensi untuk SUPER_ADMIN', async () => {
      await as(adminToken)
        .post('/api/v1/attendance/manual')
        .send({
          userId: superAdminId,
          date: WED,
          status: 'ABSENT',
          reason: 'Tidak boleh untuk atasan',
        })
        .expect(403);
    });

    describe('PATCH /attendance/:id (koreksi)', () => {
      it('jam masuk dikoreksi → status dihitung ulang, audit before/after/reason', async () => {
        const res = await as(adminToken)
          .patch(`/api/v1/attendance/${manualId}`)
          .send({ checkInAt: wib(THU, '07:55:00'), reason: 'Sesuai rekaman CCTV lobi utama' })
          .expect(200);
        expect(res.body.data).toMatchObject({
          status: 'PRESENT',
          lateMinutes: 0,
          workMinutes: 545,
          checkInMethod: 'MANUAL',
        });

        const audit = await prisma.auditLog.findFirstOrThrow({
          where: { action: AuditAction.ATTENDANCE_CORRECTED, entityId: manualId },
        });
        expect(audit.metadata).toMatchObject({
          reason: 'Sesuai rekaman CCTV lobi utama',
          before: {
            status: 'LATE',
            lateMinutes: 20,
            checkInAt: '2026-10-22T01:20:00.000Z',
            workMinutes: 520,
          },
          after: {
            status: 'PRESENT',
            lateMinutes: 0,
            checkInAt: '2026-10-22T00:55:00.000Z',
            workMinutes: 545,
          },
        });

        // Detail memuat riwayat koreksi (terbaru dulu) — terlihat juga oleh ADMIN.
        const detail = await as(adminToken).get(`/api/v1/attendance/${manualId}`).expect(200);
        const corrections = detail.body.data.corrections as {
          action: string;
          reason: string | null;
          actor: { name: string } | null;
          before: Record<string, unknown> | null;
          after: Record<string, unknown> | null;
        }[];
        expect(corrections.map((item) => item.action)).toEqual([
          'ATTENDANCE_CORRECTED',
          'ATTENDANCE_MANUAL_CREATED',
        ]);
        expect(corrections[0]).toMatchObject({
          reason: 'Sesuai rekaman CCTV lobi utama',
          before: { status: 'LATE' },
          after: { status: 'PRESENT' },
        });
        expect(corrections[0]?.actor?.name).toEqual(expect.any(String));
        expect(corrections[1]?.before).toBeNull();
        expect(detail.body.data.shiftSnapshot).toMatchObject({ startTime: expect.any(String) });
      });

      it('hanya sisi yang diubah menjadi MANUAL; metrik dari shiftSnapshot', async () => {
        const res = await as(adminToken)
          .patch(`/api/v1/attendance/${presentMondayId}`)
          .send({ checkOutAt: wib(MON, '16:30:00'), reason: 'Izin pulang cepat ke dokter' })
          .expect(200);
        expect(res.body.data).toMatchObject({
          checkInMethod: 'KIOSK_QR',
          checkOutMethod: 'MANUAL',
          earlyLeaveMinutes: 30,
          workMinutes: 520,
          status: 'PRESENT',
        });
      });

      it('status eksplisit PRESENT pada jam terlambat → keterlambatan dimaafkan (lateMinutes 0)', async () => {
        await as(adminToken)
          .patch(`/api/v1/attendance/${manualId}`)
          .send({ checkInAt: wib(THU, '08:40:00'), reason: 'Koreksi jam masuk sebenarnya' })
          .expect(200);
        const res = await as(adminToken)
          .patch(`/api/v1/attendance/${manualId}`)
          .send({ status: 'PRESENT', reason: 'Terlambat karena tugas luar kantor' })
          .expect(200);
        expect(res.body.data).toMatchObject({ status: 'PRESENT', lateMinutes: 0 });
      });

      it.each([
        ['alasan < 10 karakter', { checkInAt: wib(THU, '07:50:00'), reason: 'koreksi' }, 'reason'],
        ['tanpa perubahan', { reason: 'Tidak ada yang diubah sama sekali' }, 'checkInAt'],
        [
          'ABSENT padahal masih ada jam',
          { status: 'ABSENT', reason: 'Seharusnya tidak hadir' },
          'checkInAt',
        ],
      ])('%s → 400', async (_label, body, field) => {
        const res = await as(adminToken)
          .patch(`/api/v1/attendance/${manualId}`)
          .send(body)
          .expect(400);
        expect(errorFields(res.body)).toContain(field);
      });

      it('record berubah saat koreksi berlangsung (scan pulang) → 409, perubahan scan tidak tertimpa', async () => {
        const FRI = '2026-10-16'; // di luar minggu uji, belum punya record
        const target = await createAttendance(prisma, {
          userId: ids.absentee,
          date: FRI,
          status: 'PRESENT',
          checkInAt: new Date(wib(FRI, '07:50:00')),
          checkInMethod: 'KIOSK_QR',
          shiftSnapshot: SNAPSHOT,
        });
        const checkOutAt = new Date(wib(FRI, '17:05:00'));
        const delegate = prisma.attendance;
        const original = delegate.findUnique.bind(delegate);
        // Simulasi: tepat setelah admin membaca record, karyawan scan pulang.
        const spy = jest.spyOn(delegate, 'findUnique').mockImplementationOnce(((args: never) =>
          original(args).then(async (row: unknown) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            await prisma.attendance.update({ where: { id: target.id }, data: { checkOutAt } });
            return row;
          })) as never);
        try {
          const res = await as(adminToken)
            .patch(`/api/v1/attendance/${target.id}`)
            .send({ checkInAt: wib(FRI, '07:45:00'), reason: 'Sesuai rekaman CCTV lobi utama' })
            .expect(409);
          expect(res.body.error.code).toBe('CONFLICT');
        } finally {
          spy.mockRestore();
        }
        const saved = await prisma.attendance.findUniqueOrThrow({ where: { id: target.id } });
        expect(saved.checkOutAt).toEqual(checkOutAt);
        expect(saved.checkInAt).toEqual(new Date(wib(FRI, '07:50:00')));
      });

      it('ABSENT dengan menghapus jam → valid', async () => {
        const res = await as(adminToken)
          .patch(`/api/v1/attendance/${manualId}`)
          .send({
            status: 'ABSENT',
            checkInAt: null,
            checkOutAt: null,
            reason: 'Ternyata tidak masuk kerja',
          })
          .expect(200);
        expect(res.body.data).toMatchObject({
          status: 'ABSENT',
          checkInAt: null,
          checkOutAt: null,
          workMinutes: 0,
          checkInMethod: null,
        });
      });
    });
  });

  describe('daftar, detail & log scan', () => {
    it('GET /attendance: filter rentang, status, pencarian NIP; include user ringkas', async () => {
      const res = await as(adminToken)
        .get(`/api/v1/attendance?dateFrom=${MON}&dateTo=${FRI}&status=ABSENT&search=P-ABSENTEE`)
        .expect(200);
      // Senin & Rabu (recalculate) + Kamis (manual lalu dikoreksi menjadi ABSENT), urut tanggal terbaru.
      expect((res.body.data as { date: string }[]).map((item) => item.date)).toEqual([
        THU,
        WED,
        MON,
      ]);
      expect(res.body.data[0]).toMatchObject({
        status: 'ABSENT',
        user: { id: ids.absentee, employeeCode: 'P-ABSENTEE', department: null },
      });
      expect(res.body.meta).toMatchObject({ total: 3 });
    });

    it('rentang > 92 hari → 400; EMPLOYEE → 403', async () => {
      const res = await as(adminToken)
        .get('/api/v1/attendance?dateFrom=2026-07-01&dateTo=2026-10-23')
        .expect(400);
      expect(errorFields(res.body)).toEqual(['dateTo']);
      await as(presentToken).get('/api/v1/attendance').expect(403);
    });

    it('GET /attendance/:id → detail + scan log user pada tanggal yang sama', async () => {
      const res = await as(adminToken).get(`/api/v1/attendance/${presentMondayId}`).expect(200);
      expect(res.body.data).toMatchObject({
        id: presentMondayId,
        userId: ids.present,
        shiftSnapshot: SNAPSHOT,
        user: { employeeCode: 'P-PRESENT' },
      });
      expect(
        (res.body.data.scanLogs as { success: boolean; errorCode: string | null }[]).map((log) => [
          log.success,
          log.errorCode,
        ]),
      ).toEqual([
        [false, 'OUTSIDE_GEOFENCE'],
        [true, null],
        [true, null],
      ]);
    });

    it('GET /attendance/scan-logs?success=false → hanya scan gagal', async () => {
      const res = await as(adminToken)
        .get(`/api/v1/attendance/scan-logs?success=false&dateFrom=${MON}&dateTo=${FRI}`)
        .expect(200);
      expect((res.body.data as { errorCode: string }[]).map((log) => log.errorCode)).toEqual([
        'QR_EXPIRED',
        'OUTSIDE_GEOFENCE',
      ]);
      expect(res.body.data[0].user).toMatchObject({ employeeCode: 'P-ABSENTEE' });
    });
  });

  describe('GET /attendance/me (riwayat karyawan)', () => {
    it('daftar bulan ini + summary & attendanceRate', async () => {
      const res = await as(presentToken).get('/api/v1/attendance/me?month=2026-10').expect(200);
      expect(res.body.data.month).toBe('2026-10');
      expect((res.body.data.items as { date: string }[]).map((item) => item.date)).toEqual([
        MON,
        WED,
      ]);
      // Hari kerja lewat s/d Kamis 22 Okt (Selasa libur): 15 hari → 1 hadir.
      expect(res.body.data.summary).toMatchObject({
        present: 1,
        absent: 1,
        workingDays: 15,
        attendanceRate: 6.7,
        totalWorkMinutes: 520,
      });
    });

    it('format bulan salah → 400; ADMIN tidak punya riwayat karyawan → 403', async () => {
      await as(presentToken).get('/api/v1/attendance/me?month=2026-13').expect(400);
      await as(adminToken).get('/api/v1/attendance/me').expect(403);
    });
  });
});
