import { execSync } from 'node:child_process';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Cache } from 'cache-manager';
import ExcelJS from 'exceljs';
import type { Response as AgentResponse } from 'superagent';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ClockService } from '@/common/clock/clock.service';
import { Role } from '@/common/constants/roles';
import {
  addDays,
  fromDbDate,
  isoWeekday,
  toDbDate,
  toTzDateString,
} from '@/common/utils/date.util';
import { parseWorkDays } from '@/common/utils/time.util';
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

/** Parser supertest untuk respons file (XLSX/PDF) → Buffer. */
const binaryParser = (
  res: AgentResponse,
  callback: (error: Error | null, body: Buffer) => void,
) => {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
};

const LEAVE = new Set(['SICK', 'PERMIT', 'LEAVE']);

describe('Dashboard, reports & audit logs (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  let cache: Cache;
  const clock = new FakeClock();
  const nextIp = createIpSequence('198.24.0');

  const as = (token: string) => ({
    get: (url: string) => request(http).get(url).set('Authorization', `Bearer ${token}`),
  });

  async function freshState() {
    await cache.clear();
    app.get(SettingsService).invalidate();
  }

  beforeAll(async () => {
    app = await createE2eApp([], (builder) =>
      builder.overrideProvider(ClockService).useValue(clock),
    );
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    cache = app.get<Cache>(CACHE_MANAGER);
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  describe('angka dashboard & laporan cocok dengan data seed', () => {
    let adminToken: string;
    let today: string;

    beforeAll(async () => {
      await resetDatabase(prisma);
      // Seed memakai tanggal nyata → jam aplikasi disamakan dengan jam nyata.
      execSync('npx tsx prisma/seed.ts', { env: process.env, stdio: 'pipe', timeout: 120_000 });
      clock.set(new Date());
      today = toTzDateString(new Date());
      await freshState();
      adminToken = await loginToken(
        http,
        'admin@absenyok.id',
        nextIp(),
        process.env.SEED_DEFAULT_PASSWORD,
      );
    }, 180_000);

    it('summary hari ini dihitung ulang secara independen dari database', async () => {
      const [holiday, employees] = await Promise.all([
        prisma.holiday.findUnique({ where: { date: toDbDate(today) } }),
        prisma.user.findMany({
          where: { role: 'EMPLOYEE', isActive: true, deletedAt: null },
          include: { shift: true },
        }),
      ]);
      const scheduled = holiday
        ? []
        : employees.filter(
            (e) =>
              e.shift?.isActive && parseWorkDays(e.shift.workDays)?.includes(isoWeekday(today)),
          );
      const ids = scheduled.map((e) => e.id);
      const records = await prisma.attendance.findMany({
        where: { date: toDbDate(today), userId: { in: ids } },
      });
      const leaves = await prisma.leaveRequest.findMany({
        where: {
          userId: { in: ids },
          status: 'APPROVED',
          startDate: { lte: toDbDate(today) },
          endDate: { gte: toDbDate(today) },
        },
      });
      const withRecord = new Set(records.map((r) => r.userId));
      const by = (status: string) => records.filter((r) => r.status === status).length;
      const onLeave =
        records.filter((r) => LEAVE.has(r.status)).length +
        new Set(leaves.filter((l) => !withRecord.has(l.userId)).map((l) => l.userId)).size;
      const total = ids.length;
      const present = by('PRESENT');
      const late = by('LATE');
      const absent = by('ABSENT');

      const res = await as(adminToken).get('/api/v1/dashboard/summary').expect(200);
      expect(res.body.data).toEqual({
        date: today,
        totalEmployees: total,
        present,
        late,
        absent,
        onLeave,
        notYetCheckedIn: Math.max(0, total - present - late - absent - onLeave),
        attendanceRate: total ? Math.round(((present + late) / total) * 1000) / 10 : 0,
        holiday: holiday ? { name: holiday.name } : null,
      });
    });

    it('trend 30 hari = jumlah record per tanggal & status', async () => {
      const from = addDays(today, -29);
      const records = await prisma.attendance.findMany({
        where: { date: { gte: toDbDate(from), lte: toDbDate(today) } },
        select: { date: true, status: true },
      });
      const expected = new Map<
        string,
        { present: number; late: number; absent: number; leave: number }
      >();
      for (let date = from; date <= today; date = addDays(date, 1)) {
        expected.set(date, { present: 0, late: 0, absent: 0, leave: 0 });
      }
      for (const record of records) {
        const point = expected.get(fromDbDate(record.date));
        if (!point) continue;
        if (record.status === 'PRESENT') point.present += 1;
        else if (record.status === 'LATE') point.late += 1;
        else if (record.status === 'ABSENT') point.absent += 1;
        else point.leave += 1;
      }

      const res = await as(adminToken).get('/api/v1/dashboard/trend?days=30').expect(200);
      expect(res.body.data).toEqual(
        [...expected.entries()].map(([date, counts]) => ({ date, ...counts })),
      );
      // Seed: ada data riwayat yang benar-benar terhitung.
      const totals = (res.body.data as { present: number; late: number }[]).reduce(
        (sum, p) => sum + p.present + p.late,
        0,
      );
      expect(totals).toBeGreaterThan(100);
    });

    it('late-ranking = akumulasi lateMinutes & frekuensi terlambat per karyawan', async () => {
      const month = addDays(today, -1).slice(0, 7);
      const late = await prisma.attendance.findMany({
        where: {
          status: 'LATE',
          date: { gte: toDbDate(`${month}-01`), lte: toDbDate(`${month}-31`) },
        },
        include: { user: true },
      });
      const totals = new Map<
        string,
        { employeeCode: string; userId: string; lateCount: number; totalLateMinutes: number }
      >();
      for (const record of late) {
        const item = totals.get(record.userId) ?? {
          employeeCode: record.user.employeeCode,
          userId: record.userId,
          lateCount: 0,
          totalLateMinutes: 0,
        };
        item.lateCount += 1;
        item.totalLateMinutes += record.lateMinutes;
        totals.set(record.userId, item);
      }
      const expected = [...totals.values()]
        .sort((a, b) => b.totalLateMinutes - a.totalLateMinutes || a.userId.localeCompare(b.userId))
        .slice(0, 10)
        .map(({ employeeCode, lateCount, totalLateMinutes }) => ({
          employeeCode,
          lateCount,
          totalLateMinutes,
        }));

      const res = await as(adminToken)
        .get(`/api/v1/dashboard/late-ranking?month=${month}`)
        .expect(200);
      expect(
        (
          res.body.data as {
            user: { employeeCode: string };
            lateCount: number;
            totalLateMinutes: number;
          }[]
        ).map((item) => ({
          employeeCode: item.user.employeeCode,
          lateCount: item.lateCount,
          totalLateMinutes: item.totalLateMinutes,
        })),
      ).toEqual(expected);
    });

    it('rekap bulanan per karyawan = jumlah status di database', async () => {
      const month = addDays(today, -1).slice(0, 7);
      const records = await prisma.attendance.findMany({
        where: { date: { gte: toDbDate(`${month}-01`), lte: toDbDate(`${month}-31`) } },
        include: { user: true },
      });
      const res = await as(adminToken).get(`/api/v1/reports/monthly?month=${month}`).expect(200);
      const rows = res.body.data.items as {
        employeeCode: string;
        present: number;
        late: number;
        absent: number;
        sick: number;
        permit: number;
        totalLateMinutes: number;
        totalWorkMinutes: number;
      }[];
      expect(rows).toHaveLength(10);
      for (const row of rows) {
        const own = records.filter((r) => r.user.employeeCode === row.employeeCode);
        expect(row).toMatchObject({
          present: own.filter((r) => r.status === 'PRESENT').length,
          late: own.filter((r) => r.status === 'LATE').length,
          absent: own.filter((r) => r.status === 'ABSENT').length,
          sick: own.filter((r) => r.status === 'SICK').length,
          permit: own.filter((r) => r.status === 'PERMIT').length,
          totalLateMinutes: own.reduce((sum, r) => sum + r.lateMinutes, 0),
          totalWorkMinutes: own.reduce((sum, r) => sum + r.workMinutes, 0),
        });
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('skenario terkontrol (Senin 19 Okt 2026, 10:00 WIB)', () => {
    const MONDAY = '2026-10-19';
    const wib = (date: string, time: string) => new Date(`${date}T${time}+07:00`);
    let adminToken: string;
    let superAdminToken: string;
    let employeeToken: string;
    const ids: Record<string, string> = {};

    beforeAll(async () => {
      await resetDatabase(prisma);
      clock.set(wib(MONDAY, '10:00:00'));
      await freshState();

      const regular = (
        await prisma.shift.create({
          data: { name: 'Reguler', startTime: '08:00', endTime: '17:00' },
        })
      ).id;
      const saturday = (
        await prisma.shift.create({
          data: { name: 'Sabtu', startTime: '08:00', endTime: '13:00', workDays: '6' },
        })
      ).id;
      const location = await prisma.location.create({
        data: { name: 'Kantor', latitude: '-6.2', longitude: '106.8' },
      });
      const kiosk = await prisma.kiosk.create({
        data: { name: 'Lobi', locationId: location.id, secret: 'k'.repeat(128) },
      });

      await createUserFixture(prisma, {
        employeeCode: 'SA',
        email: 'sa@dr.test',
        role: Role.SUPER_ADMIN,
      });
      await createUserFixture(prisma, {
        employeeCode: 'ADM',
        email: 'adm@dr.test',
        role: Role.ADMIN,
      });
      for (const key of ['P', 'L', 'A', 'V', 'S', 'N']) {
        ids[key] = (
          await createUserFixture(prisma, {
            employeeCode: `E-${key}`,
            email: `${key.toLowerCase()}@dr.test`,
            role: Role.EMPLOYEE,
            shiftId: regular,
          })
        ).id;
      }
      ids.W = (
        await createUserFixture(prisma, {
          employeeCode: 'E-W',
          email: 'w@dr.test',
          role: Role.EMPLOYEE,
          shiftId: saturday,
        })
      ).id;
      await createUserFixture(prisma, {
        employeeCode: 'E-X',
        email: 'x@dr.test',
        role: Role.EMPLOYEE,
        shiftId: regular,
        isActive: false,
      });

      const day = toDbDate(MONDAY);
      await prisma.attendance.createMany({
        data: [
          {
            userId: ids.P,
            date: day,
            status: 'PRESENT',
            checkInAt: wib(MONDAY, '07:50:00'),
            checkInMethod: 'KIOSK_QR',
            kioskId: kiosk.id,
          },
          {
            userId: ids.L,
            date: day,
            status: 'LATE',
            lateMinutes: 20,
            checkInAt: wib(MONDAY, '08:20:00'),
            checkInMethod: 'KIOSK_QR',
            kioskId: kiosk.id,
          },
          { userId: ids.A, date: day, status: 'ABSENT' },
          { userId: ids.S, date: day, status: 'SICK' },
          // Riwayat bulan ini untuk late-ranking & rekap.
          {
            userId: ids.P,
            date: toDbDate('2026-10-15'),
            status: 'LATE',
            lateMinutes: 70,
            checkInAt: wib('2026-10-15', '09:10:00'),
            workMinutes: 400,
          },
          {
            userId: ids.L,
            date: toDbDate('2026-10-16'),
            status: 'LATE',
            lateMinutes: 30,
            checkInAt: wib('2026-10-16', '08:30:00'),
            workMinutes: 500,
          },
        ],
      });
      await prisma.leaveRequest.create({
        data: {
          userId: ids.V,
          type: 'ANNUAL',
          startDate: day,
          endDate: day,
          totalDays: 1,
          reason: 'Cuti',
          status: 'APPROVED',
        },
      });

      superAdminToken = await loginToken(http, 'sa@dr.test', nextIp());
      adminToken = await loginToken(http, 'adm@dr.test', nextIp());
      employeeToken = await loginToken(http, 'p@dr.test', nextIp());
    });

    describe('dashboard', () => {
      it('summary: total = yang dijadwalkan hari ini; cuti tanpa record ikut onLeave', async () => {
        const res = await as(adminToken).get('/api/v1/dashboard/summary').expect(200);
        expect(res.body.data).toEqual({
          date: MONDAY,
          totalEmployees: 6,
          present: 1,
          late: 1,
          absent: 1,
          onLeave: 2,
          notYetCheckedIn: 1,
          attendanceRate: 33.3,
          holiday: null,
        });
      });

      it('summary di-cache 30 detik (data baru belum terlihat sampai cache kedaluwarsa)', async () => {
        await prisma.attendance.create({
          data: {
            userId: ids.N,
            date: toDbDate(MONDAY),
            status: 'PRESENT',
            checkInAt: wib(MONDAY, '09:00:00'),
          },
        });
        const cached = await as(adminToken).get('/api/v1/dashboard/summary').expect(200);
        expect(cached.body.data.notYetCheckedIn).toBe(1);

        await cache.clear();
        const fresh = await as(adminToken).get('/api/v1/dashboard/summary').expect(200);
        expect(fresh.body.data).toMatchObject({ present: 2, notYetCheckedIn: 0 });
      });

      it('trend: tanggal tanpa data diisi 0', async () => {
        const res = await as(adminToken).get('/api/v1/dashboard/trend?days=3').expect(200);
        expect(res.body.data).toEqual([
          { date: '2026-10-17', present: 0, late: 0, absent: 0, leave: 0 },
          { date: '2026-10-18', present: 0, late: 0, absent: 0, leave: 0 },
          { date: MONDAY, present: 2, late: 1, absent: 1, leave: 1 },
        ]);
      });

      it('late-ranking: urut total menit terlambat', async () => {
        const res = await as(adminToken)
          .get('/api/v1/dashboard/late-ranking?month=2026-10')
          .expect(200);
        expect(
          (
            res.body.data as {
              rank: number;
              user: { employeeCode: string };
              lateCount: number;
              totalLateMinutes: number;
            }[]
          ).map((item) => [
            item.rank,
            item.user.employeeCode,
            item.lateCount,
            item.totalLateMinutes,
          ]),
        ).toEqual([
          [1, 'E-P', 1, 70],
          [2, 'E-L', 2, 50],
        ]);
      });

      it('recent-activity: kejadian terbaru hari ini lebih dulu, dengan kiosk', async () => {
        const res = await as(adminToken).get('/api/v1/dashboard/recent-activity').expect(200);
        expect(
          (
            res.body.data as {
              user: { employeeCode: string };
              type: string;
              kiosk: { name: string } | null;
            }[]
          ).map((item) => [item.user.employeeCode, item.type, item.kiosk?.name ?? null]),
        ).toEqual([
          ['E-N', 'CHECK_IN', null],
          ['E-L', 'CHECK_IN', 'Lobi'],
          ['E-P', 'CHECK_IN', 'Lobi'],
        ]);
      });

      it('hari libur → totalEmployees 0 & nama libur', async () => {
        await prisma.holiday.create({ data: { date: toDbDate('2026-10-20'), name: 'Libur Uji' } });
        clock.set(wib('2026-10-20', '10:00:00'));
        await cache.clear();
        const res = await as(adminToken).get('/api/v1/dashboard/summary').expect(200);
        expect(res.body.data).toMatchObject({
          totalEmployees: 0,
          attendanceRate: 0,
          holiday: { name: 'Libur Uji' },
        });
        clock.set(wib(MONDAY, '10:00:00'));
        await cache.clear();
      });
    });

    describe('laporan', () => {
      it('rekap bulanan JSON', async () => {
        const res = await as(adminToken).get('/api/v1/reports/monthly?month=2026-10').expect(200);
        const items = res.body.data.items as { employeeCode: string }[];
        // Karyawan nonaktif tanpa data bulan ini (E-X) tidak ikut.
        expect(items.map((item) => item.employeeCode)).toEqual([
          'E-A',
          'E-L',
          'E-N',
          'E-P',
          'E-S',
          'E-V',
          'E-W',
        ]);
        expect(items.find((item) => item.employeeCode === 'E-P')).toMatchObject({
          present: 1,
          late: 1,
          totalLateMinutes: 70,
          workingDays: 13,
          attendanceRate: 15.4,
        });
      });

      it('export XLSX: 2 sheet, header tebal, freeze pane, autofilter, persen, legenda', async () => {
        const res = await as(adminToken)
          .get('/api/v1/reports/monthly/export?month=2026-10&format=xlsx')
          .buffer(true)
          .parse(binaryParser)
          .expect(200);
        expect(res.headers['content-type']).toContain('spreadsheetml');
        expect(res.headers['content-disposition']).toBe(
          'attachment; filename="rekap-absensi-2026-10.xlsx"',
        );

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body as ArrayBuffer);
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Rekap', 'Detail Harian']);

        const rekap = workbook.getWorksheet('Rekap')!;
        expect(rekap.getCell('A1').value).toContain('REKAP ABSENSI KARYAWAN');
        expect(rekap.getCell('A2').value).toBe('Periode: Oktober 2026');
        expect(rekap.getRow(4).getCell(2).value).toBe('NIP');
        expect(rekap.getRow(4).getCell(2).font?.bold).toBe(true);
        expect(rekap.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
        expect(rekap.autoFilter).toBe('A4:N4');
        const pRow = [...Array(rekap.rowCount).keys()]
          .map((i) => rekap.getRow(i + 1))
          .find((row) => row.getCell(2).value === 'E-P')!;
        expect(pRow.getCell(14).value).toBeCloseTo(0.154, 3);
        expect(pRow.getCell(14).numFmt).toBe('0.0%');

        const detail = workbook.getWorksheet('Detail Harian')!;
        expect(detail.getRow(4).values).toHaveLength(2 + 31 + 1); // [kosong, NIP, Nama, 1..31]
        const pDetail = [...Array(detail.rowCount).keys()]
          .map((i) => detail.getRow(i + 1))
          .find((row) => row.getCell(1).value === 'E-P')!;
        expect(pDetail.getCell(2 + 15).value).toBe('T');
        expect(pDetail.getCell(2 + 19).value).toBe('H');
        expect(pDetail.getCell(2 + 17).value).toBeNull(); // Sabtu
        const lastRows = [...Array(10).keys()].map(
          (i) => detail.getRow(detail.rowCount - 9 + i).getCell(1).value,
        );
        expect(lastRows).toEqual(
          expect.arrayContaining(['Keterangan:', 'H', 'T', 'A', 'S', 'I', 'C', 'L']),
        );
      });

      it('export PDF bulanan', async () => {
        const res = await as(adminToken)
          .get('/api/v1/reports/monthly/export?month=2026-10&format=pdf')
          .buffer(true)
          .parse(binaryParser)
          .expect(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(res.headers['content-disposition']).toBe(
          'attachment; filename="rekap-absensi-2026-10.pdf"',
        );
        expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      });

      it('export harian XLSX: semua yang dijadwalkan termasuk yang belum absen', async () => {
        const res = await as(adminToken)
          .get(`/api/v1/reports/daily/export?date=${MONDAY}&format=xlsx`)
          .buffer(true)
          .parse(binaryParser)
          .expect(200);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body as ArrayBuffer);
        const sheet = workbook.getWorksheet('Harian')!;
        const statuses: Record<string, unknown> = {};
        for (let r = 5; r <= sheet.rowCount; r += 1) {
          statuses[sheet.getRow(r).getCell(2).text] = sheet.getRow(r).getCell(5).value;
        }
        expect(statuses).toEqual({
          'E-A': 'Alpa',
          'E-L': 'Terlambat',
          'E-N': 'Hadir',
          'E-P': 'Hadir',
          'E-S': 'Sakit',
          'E-V': 'Cuti',
        });
      });

      it('export harian tanggal masa depan → 400; format tidak dikenal → 400', async () => {
        await as(adminToken)
          .get('/api/v1/reports/daily/export?date=2026-10-20&format=pdf')
          .expect(400);
        await as(adminToken)
          .get(`/api/v1/reports/daily/export?date=${MONDAY}&format=docx`)
          .expect(400);
      });

      it('laporan pribadi PDF untuk karyawan', async () => {
        const res = await as(employeeToken)
          .get('/api/v1/reports/me/export?month=2026-10&format=pdf')
          .buffer(true)
          .parse(binaryParser)
          .expect(200);
        expect(res.headers['content-disposition']).toBe(
          'attachment; filename="kehadiran-E-P-2026-10.pdf"',
        );
        expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      });
    });

    describe('hak akses', () => {
      it.each([
        '/api/v1/dashboard/summary',
        '/api/v1/dashboard/trend',
        '/api/v1/dashboard/late-ranking',
        '/api/v1/dashboard/recent-activity',
        '/api/v1/reports/monthly?month=2026-10',
        '/api/v1/reports/monthly/export?month=2026-10&format=xlsx',
        `/api/v1/reports/daily/export?date=${MONDAY}&format=pdf`,
        '/api/v1/audit-logs',
      ])('EMPLOYEE → 403 untuk %s', async (url) => {
        const res = await as(employeeToken).get(url).expect(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('ADMIN tidak bisa membaca audit log & tidak punya laporan pribadi', async () => {
        await as(adminToken).get('/api/v1/audit-logs').expect(403);
        await as(adminToken).get('/api/v1/reports/me/export?month=2026-10').expect(403);
      });

      it('SUPER_ADMIN membaca audit log dengan filter + aktor ringkas', async () => {
        const res = await as(superAdminToken)
          .get('/api/v1/audit-logs?action=LOGIN&limit=5')
          .expect(200);
        expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
        expect(res.body.data[0]).toMatchObject({
          action: 'LOGIN',
          entity: 'User',
          actor: { email: expect.any(String), role: expect.any(String) },
        });
        expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      });
    });
  });
});
