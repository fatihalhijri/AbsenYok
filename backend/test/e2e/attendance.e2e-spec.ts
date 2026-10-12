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
  FakeClock,
  loginToken,
  resetDatabase,
} from './e2e-utils';

/** Senin 19 Okt 2026 (WIB). */
const MONDAY = '2026-10-19';
const TUESDAY = '2026-10-20';
const SATURDAY = '2026-10-24';
const wib = (date: string, time: string) => `${date}T${time}+07:00`;

const OFFICE = { latitude: -6.2, longitude: 106.8166667 };
/** ±22 m dari titik kantor. */
const NEAR = { latitude: -6.2002, longitude: 106.8166667, accuracy: 12 };
const FAR = { latitude: -6.2022, longitude: 106.8166667, accuracy: 10 };
const DEVICE_A = '0b8f9e1a-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
const DEVICE_B = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

type Employee =
  | 'main'
  | 'late'
  | 'rules'
  | 'days'
  | 'noShift'
  | 'onLeave'
  | 'personal'
  | 'flood'
  | 'race'
  | 'absent';

describe('Attendance scan (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const clock = new FakeClock();
  const nextIp = createIpSequence('198.21.0');

  let adminToken: string;
  let adminId: string;
  let kioskId: string;
  let locationId: string;
  const ids = {} as Record<Employee, string>;
  const tokens = {} as Record<Employee, string>;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Token QR kiosk terkini menurut jam (palsu) server, diambil lewat endpoint admin. */
  async function kioskQr(): Promise<string> {
    const res = await request(http)
      .get(`/api/v1/kiosks/${kioskId}/qr`)
      .set(auth(adminToken))
      .expect(200);
    return (res.body as { data: { token: string } }).data.token;
  }

  function scan(employee: Employee, qrToken: string, body: Record<string, unknown> = {}) {
    return request(http)
      .post('/api/v1/attendance/scan')
      .set(auth(tokens[employee]))
      .send({ qrToken, ...NEAR, deviceId: DEVICE_A, ...body });
  }

  const logsOf = (userId: string) =>
    prisma.attendanceScanLog.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    app = await createE2eApp([], (builder) =>
      builder.overrideProvider(ClockService).useValue(clock),
    );
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    app.get(SettingsService).invalidate();

    locationId = (
      await prisma.location.create({
        data: {
          name: 'Kantor Pusat',
          latitude: OFFICE.latitude.toFixed(7),
          longitude: OFFICE.longitude.toFixed(7),
        },
      })
    ).id;
    kioskId = (
      await prisma.kiosk.create({
        data: { name: 'Lobi Utama', locationId, secret: 'a1'.repeat(64) },
      })
    ).id;
    const shiftId = (
      await prisma.shift.create({ data: { name: 'Reguler', startTime: '08:00', endTime: '17:00' } })
    ).id;
    await prisma.holiday.create({ data: { date: toDbDate(TUESDAY), name: 'Libur Uji' } });

    adminId = (
      await createUserFixture(prisma, {
        employeeCode: 'ADM',
        email: 'adm@att.test',
        role: Role.ADMIN,
      })
    ).id;
    const employees: Employee[] = [
      'main',
      'late',
      'rules',
      'days',
      'noShift',
      'onLeave',
      'personal',
      'flood',
      'race',
      'absent',
    ];
    for (const key of employees) {
      ids[key] = (
        await createUserFixture(prisma, {
          employeeCode: `E-${key.toUpperCase()}`,
          email: `${key.toLowerCase()}@att.test`,
          role: Role.EMPLOYEE,
          shiftId: key === 'noShift' ? undefined : shiftId,
        })
      ).id;
    }
    await prisma.leaveRequest.create({
      data: {
        userId: ids.onLeave,
        type: 'SICK',
        startDate: toDbDate(MONDAY),
        endDate: toDbDate(TUESDAY),
        totalDays: 2,
        reason: 'Demam',
        status: 'APPROVED',
      },
    });

    adminToken = await loginToken(http, 'adm@att.test', nextIp());
    for (const key of employees) {
      tokens[key] = await loginToken(http, `${key.toLowerCase()}@att.test`, nextIp());
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('alur lengkap: token kiosk → masuk → pulang → scan ketiga ditolak', () => {
    it('GET /attendance/me/today sebelum absen: boleh masuk, jendela dibuka 07:00', async () => {
      clock.set(wib(MONDAY, '07:30:00'));
      const res = await request(http)
        .get('/api/v1/attendance/me/today')
        .set(auth(tokens.main))
        .expect(200);
      expect(res.body.data).toMatchObject({
        date: MONDAY,
        attendance: null,
        isWorkingDay: true,
        holiday: null,
        leave: null,
        canCheckIn: true,
        canCheckOut: false,
        checkInOpensAt: '2026-10-19T00:00:00.000Z',
        checkInClosesAt: '2026-10-19T10:00:00.000Z',
        shift: { name: 'Reguler', startTime: '08:00', endTime: '17:00' },
      });
    });

    it('scan masuk 07:50 → CHECK_IN PRESENT, device terikat, log berhasil', async () => {
      clock.set(wib(MONDAY, '07:50:20'));
      const res = await scan('main', await kioskQr()).expect(200);

      expect(res.body.data).toMatchObject({
        type: 'CHECK_IN',
        message: 'Absen masuk berhasil pukul 07:50. Selamat bekerja!',
        user: { name: 'User E-MAIN', employeeCode: 'E-MAIN' },
        attendance: {
          date: MONDAY,
          status: 'PRESENT',
          lateMinutes: 0,
          checkInAt: '2026-10-19T00:50:20.000Z',
          checkInMethod: 'KIOSK_QR',
          kioskId,
          locationId,
        },
      });

      const row = await prisma.attendance.findFirstOrThrow({ where: { userId: ids.main } });
      expect(row.shiftSnapshot).toEqual({
        name: 'Reguler',
        startTime: '08:00',
        endTime: '17:00',
        lateToleranceMinutes: 15,
      });
      expect(row.checkInLat?.toNumber()).toBe(NEAR.latitude);

      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.main } });
      expect(user.boundDeviceId).toBe(DEVICE_A);
      expect(
        await prisma.auditLog.count({
          where: { actorId: ids.main, action: AuditAction.DEVICE_BOUND },
        }),
      ).toBe(1);

      const [log] = await logsOf(ids.main);
      expect(log).toMatchObject({
        success: true,
        kioskId,
        scanType: 'KIOSK',
        deviceId: DEVICE_A,
        errorCode: null,
      });
      expect(log.distance).toBe(22);
    });

    it('kartu beranda setelah masuk: belum boleh pulang (jeda 5 menit)', async () => {
      clock.set(wib(MONDAY, '07:52:00'));
      const res = await request(http)
        .get('/api/v1/attendance/me/today')
        .set(auth(tokens.main))
        .expect(200);
      expect(res.body.data).toMatchObject({
        canCheckIn: false,
        canCheckOut: false,
        checkOutAvailableAt: '2026-10-19T00:55:20.000Z',
        attendance: { status: 'PRESENT' },
      });
    });

    it('scan pulang terlalu cepat → 422 CHECKOUT_TOO_SOON { minutesLeft }', async () => {
      clock.set(wib(MONDAY, '07:53:00'));
      const res = await scan('main', await kioskQr()).expect(422);
      expect(res.body.error).toMatchObject({
        code: 'CHECKOUT_TOO_SOON',
        message: 'Absen pulang baru bisa dilakukan 3 menit lagi (pukul 07:55)',
        details: { minutesLeft: 3 },
      });
    });

    it('device lain → 422 DEVICE_MISMATCH', async () => {
      clock.set(wib(MONDAY, '12:00:00'));
      const res = await scan('main', await kioskQr(), { deviceId: DEVICE_B }).expect(422);
      expect(res.body.error).toMatchObject({
        code: 'DEVICE_MISMATCH',
        message: 'Akun terdaftar di perangkat lain. Hubungi admin',
      });
    });

    it('scan pulang 17:05 → CHECK_OUT dengan total kerja', async () => {
      clock.set(wib(MONDAY, '17:05:40'));
      const res = await scan('main', await kioskQr()).expect(200);
      expect(res.body.data).toMatchObject({
        type: 'CHECK_OUT',
        message: 'Absen pulang berhasil pukul 17:05. Total kerja 9 jam 15 menit.',
        attendance: {
          status: 'PRESENT',
          checkOutAt: '2026-10-19T10:05:40.000Z',
          checkOutMethod: 'KIOSK_QR',
          earlyLeaveMinutes: 0,
          workMinutes: 555,
        },
      });
    });

    it('scan ketiga → 409 ALREADY_CHECKED_OUT', async () => {
      clock.set(wib(MONDAY, '17:10:00'));
      const res = await scan('main', await kioskQr()).expect(409);
      expect(res.body.error.code).toBe('ALREADY_CHECKED_OUT');
    });

    it('setiap percobaan (berhasil & gagal) tercatat di attendance_scan_logs', async () => {
      const logs = await logsOf(ids.main);
      expect(logs.map((log) => [log.success, log.errorCode])).toEqual([
        [true, null],
        [false, 'CHECKOUT_TOO_SOON'],
        [false, 'DEVICE_MISMATCH'],
        [true, null],
        [false, 'ALREADY_CHECKED_OUT'],
      ]);
      expect(logs.every((log) => log.kioskId === kioskId && log.userId === ids.main)).toBe(true);
    });

    it('layar kiosk menampilkan scan berhasil (recent-scans)', async () => {
      const res = await request(http)
        .get(`/api/v1/kiosks/${kioskId}/recent-scans`)
        .set(auth(adminToken))
        .expect(200);
      const mine = (res.body.data as { employeeCode: string; type: string }[]).filter(
        (s) => s.employeeCode === 'E-MAIN',
      );
      expect(mine.map((s) => s.type)).toEqual(['CHECK_OUT', 'CHECK_IN']);
    });
  });

  describe('status terlambat', () => {
    it('masuk 08:20 → LATE, lateMinutes dihitung dari jam masuk', async () => {
      clock.set(wib(MONDAY, '08:20:05'));
      const res = await scan('late', await kioskQr()).expect(200);
      expect(res.body.data.attendance).toMatchObject({ status: 'LATE', lateMinutes: 20 });
      expect(res.body.data.message).toBe(
        'Absen masuk berhasil pukul 08:20. Anda terlambat 20 menit.',
      );
    });
  });

  describe('validasi token, geofence, & jendela waktu', () => {
    it('token sampah → 422 QR_INVALID; token 2 window lalu → 422 QR_EXPIRED', async () => {
      clock.set(wib(MONDAY, '09:00:00'));
      const invalid = await scan('rules', 'https://contoh.com/bukan-token').expect(422);
      expect(invalid.body.error.code).toBe('QR_INVALID');

      const oldToken = await kioskQr();
      clock.set(wib(MONDAY, '09:01:05'));
      const expired = await scan('rules', oldToken).expect(422);
      expect(expired.body.error.code).toBe('QR_EXPIRED');
    });

    it('akurasi GPS buruk → LOCATION_ACCURACY_LOW; di luar radius → OUTSIDE_GEOFENCE { distance, radius }', async () => {
      clock.set(wib(MONDAY, '09:02:00'));
      const token = await kioskQr();
      const weak = await scan('rules', token, { accuracy: 500 }).expect(422);
      expect(weak.body.error).toMatchObject({
        code: 'LOCATION_ACCURACY_LOW',
        details: { accuracy: 500, maxAccuracy: 100 },
      });

      const outside = await scan('rules', token, FAR).expect(422);
      expect(outside.body.error).toMatchObject({
        code: 'OUTSIDE_GEOFENCE',
        message: 'Anda berada 245 m dari lokasi kantor (maks 100 m)',
        details: { distance: 245, radius: 100 },
      });
    });

    it('scan gagal TIDAK mengikat device', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.rules } });
      expect(user.boundDeviceId).toBeNull();
    });

    it('sebelum jendela dibuka → CHECKIN_WINDOW_CLOSED { opensAt }; setelah jam pulang → { closedAt }', async () => {
      clock.set(wib(MONDAY, '06:30:00'));
      const early = await scan('rules', await kioskQr()).expect(422);
      expect(early.body.error).toMatchObject({
        code: 'CHECKIN_WINDOW_CLOSED',
        message: 'Absen masuk baru dibuka pukul 07:00',
        details: { opensAt: '2026-10-19T00:00:00.000Z' },
      });

      clock.set(wib(MONDAY, '17:30:00'));
      const late = await scan('rules', await kioskQr()).expect(422);
      expect(late.body.error).toMatchObject({
        code: 'CHECKIN_WINDOW_CLOSED',
        message: 'Jam absen masuk sudah berakhir pukul 17:00',
      });
    });

    it('kiosk nonaktif → 422 KIOSK_INACTIVE', async () => {
      clock.set(wib(MONDAY, '09:10:00'));
      const token = await kioskQr();
      await request(http)
        .patch(`/api/v1/kiosks/${kioskId}`)
        .set(auth(adminToken))
        .send({ isActive: false })
        .expect(200);
      const res = await scan('rules', token).expect(422);
      expect(res.body.error.code).toBe('KIOSK_INACTIVE');
      await request(http)
        .patch(`/api/v1/kiosks/${kioskId}`)
        .set(auth(adminToken))
        .send({ isActive: true })
        .expect(200);
    });

    it('geofence dimatikan lewat settings → scan dari luar radius diterima', async () => {
      const settings = app.get(SettingsService);
      await prisma.setting.create({ data: { key: 'attendance.geofenceEnabled', value: 'false' } });
      settings.invalidate();

      clock.set(wib(MONDAY, '09:15:00'));
      const res = await scan('rules', await kioskQr(), FAR).expect(200);
      expect(res.body.data.attendance).toMatchObject({ status: 'LATE', lateMinutes: 75 });

      await prisma.setting.delete({ where: { key: 'attendance.geofenceEnabled' } });
      settings.invalidate();
    });

    it('semua percobaan gagal tercatat dengan kode error', async () => {
      // Jam palsu sempat mundur (06:30) sehingga dibandingkan sebagai himpunan, bukan urutan.
      const logs = await logsOf(ids.rules);
      expect(logs.map((log) => log.errorCode ?? 'OK').sort()).toEqual(
        [
          'QR_INVALID',
          'QR_EXPIRED',
          'LOCATION_ACCURACY_LOW',
          'OUTSIDE_GEOFENCE',
          'CHECKIN_WINDOW_CLOSED',
          'CHECKIN_WINDOW_CLOSED',
          'KIOSK_INACTIVE',
          'OK',
        ].sort(),
      );
      // Token tidak terbaca → kiosk tidak diketahui; gagal geofence → jarak tetap dicatat.
      expect(logs.find((log) => log.errorCode === 'QR_INVALID')?.kioskId).toBeNull();
      expect(logs.find((log) => log.errorCode === 'OUTSIDE_GEOFENCE')).toMatchObject({
        distance: 245,
        success: false,
        kioskId,
      });
    });
  });

  describe('hari kerja, libur, cuti, shift', () => {
    it('hari Sabtu untuk shift Sen–Jum → NOT_WORKING_DAY', async () => {
      clock.set(wib(SATURDAY, '08:00:00'));
      const res = await scan('days', await kioskQr()).expect(422);
      expect(res.body.error.code).toBe('NOT_WORKING_DAY');
    });

    it('hari libur → HOLIDAY dengan nama libur', async () => {
      clock.set(wib(TUESDAY, '08:00:00'));
      const res = await scan('days', await kioskQr()).expect(422);
      expect(res.body.error).toMatchObject({
        code: 'HOLIDAY',
        message: 'Hari ini hari libur: Libur Uji',
      });

      const today = await request(http)
        .get('/api/v1/attendance/me/today')
        .set(auth(tokens.days))
        .expect(200);
      expect(today.body.data).toMatchObject({
        holiday: { date: TUESDAY, name: 'Libur Uji' },
        canCheckIn: false,
      });
    });

    it('cuti/sakit disetujui → ON_LEAVE', async () => {
      clock.set(wib(MONDAY, '08:00:00'));
      const res = await scan('onLeave', await kioskQr()).expect(422);
      expect(res.body.error).toMatchObject({
        code: 'ON_LEAVE',
        message: 'Anda sedang sakit hari ini',
      });
    });

    it('tanpa shift → NO_SHIFT_ASSIGNED', async () => {
      const res = await scan('noShift', await kioskQr()).expect(422);
      expect(res.body.error.code).toBe('NO_SHIFT_ASSIGNED');
    });

    it('record ABSENT buatan admin untuk hari ini dilengkapi saat check-in (tidak duplikat)', async () => {
      await prisma.attendance.create({
        data: { userId: ids.absent, date: toDbDate(MONDAY), status: 'ABSENT' },
      });
      clock.set(wib(MONDAY, '09:30:00'));
      const res = await scan('absent', await kioskQr()).expect(200);
      expect(res.body.data).toMatchObject({
        type: 'CHECK_IN',
        attendance: { status: 'LATE', lateMinutes: 90 },
      });
      expect(await prisma.attendance.count({ where: { userId: ids.absent } })).toBe(1);
    });
  });

  describe('QR personal (mode cadangan)', () => {
    let personalToken: string;

    beforeAll(async () => {
      clock.set(wib(MONDAY, '08:05:00'));
      const res = await request(http)
        .get('/api/v1/users/me/qr')
        .set(auth(tokens.personal))
        .expect(200);
      personalToken = (res.body as { data: { token: string } }).data.token;
    });

    it('EMPLOYEE tidak boleh memakai personal-scan', async () => {
      await request(http)
        .post('/api/v1/attendance/personal-scan')
        .set(auth(tokens.late))
        .send({ qrToken: personalToken, locationId, ...NEAR })
        .expect(403);
    });

    it('petugas di luar radius → OUTSIDE_GEOFENCE', async () => {
      const res = await request(http)
        .post('/api/v1/attendance/personal-scan')
        .set(auth(adminToken))
        .send({ qrToken: personalToken, locationId, ...FAR })
        .expect(422);
      expect(res.body.error.code).toBe('OUTSIDE_GEOFENCE');
    });

    it('admin memindai QR karyawan → CHECK_IN PERSONAL_QR, scannedById petugas, tanpa device binding', async () => {
      clock.set(wib(MONDAY, '08:05:30'));
      const res = await request(http)
        .post('/api/v1/attendance/personal-scan')
        .set(auth(adminToken))
        .send({ qrToken: personalToken, locationId, ...NEAR })
        .expect(200);
      expect(res.body.data).toMatchObject({
        type: 'CHECK_IN',
        user: { employeeCode: 'E-PERSONAL' },
        attendance: { checkInMethod: 'PERSONAL_QR', kioskId: null, locationId, status: 'PRESENT' },
      });

      const row = await prisma.attendance.findFirstOrThrow({ where: { userId: ids.personal } });
      expect(row.scannedById).toBe(adminId);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.personal } });
      expect(user.boundDeviceId).toBeNull();
    });

    it('token yang sama dipakai lagi → 422 QR_ALREADY_USED', async () => {
      clock.set(wib(MONDAY, '08:05:50'));
      const res = await request(http)
        .post('/api/v1/attendance/personal-scan')
        .set(auth(adminToken))
        .send({ qrToken: personalToken, locationId, ...NEAR })
        .expect(422);
      expect(res.body.error.code).toBe('QR_ALREADY_USED');

      const logs = await logsOf(ids.personal);
      expect(logs.map((log) => [log.scanType, log.success, log.errorCode])).toEqual([
        ['PERSONAL', false, 'OUTSIDE_GEOFENCE'],
        ['PERSONAL', true, null],
        ['PERSONAL', false, 'QR_ALREADY_USED'],
      ]);
    });
  });

  describe('keamanan', () => {
    it('lebih dari 10 scan/menit per user → 429 TOO_MANY_REQUESTS (Retry-After)', async () => {
      clock.set(wib(MONDAY, '10:00:00'));
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        await scan('flood', `sampah-${attempt}`).expect(422);
      }
      const res = await scan('flood', 'sampah-11').expect(429);
      expect(res.body.error).toMatchObject({
        code: 'TOO_MANY_REQUESTS',
        details: { retryAfterSeconds: expect.any(Number) },
      });
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);

      // User lain tidak terdampak.
      await scan('late', 'sampah').expect(422);
    });

    it('dua scan masuk bersamaan → hanya satu record, satu ditolak', async () => {
      clock.set(wib(MONDAY, '07:58:00'));
      const token = await kioskQr();
      const results = await Promise.all([scan('race', token), scan('race', token)]);
      const statuses = results.map((res) => res.status).sort();

      expect(statuses[0]).toBe(200);
      expect([409, 422]).toContain(statuses[1]);
      expect(await prisma.attendance.count({ where: { userId: ids.race } })).toBe(1);
      const rejected = results.find((res) => res.status !== 200);
      expect(['ALREADY_CHECKED_IN', 'CHECKOUT_TOO_SOON', 'DEVICE_MISMATCH']).toContain(
        rejected?.body.error.code,
      );
    });

    it('body tidak valid → 400 VALIDATION_ERROR', async () => {
      const res = await request(http)
        .post('/api/v1/attendance/scan')
        .set(auth(tokens.late))
        .send({
          qrToken: 'x',
          latitude: 120,
          longitude: 'abc',
          accuracy: -1,
          deviceId: 'bukan-uuid',
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('ADMIN tidak boleh memakai endpoint scan karyawan', async () => {
      await request(http)
        .post('/api/v1/attendance/scan')
        .set(auth(adminToken))
        .send({ qrToken: 'x', ...NEAR, deviceId: DEVICE_A })
        .expect(403);
    });
  });
});
