import { Injectable } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import { fieldError, notFoundError } from '@/common/exceptions/error-factories';
import { type DateRange, eachDate, monthRange } from '@/common/utils/date-range.util';
import {
  formatLocalTime,
  fromDbDate,
  isoWeekday,
  toDbDate,
  toTzDateString,
} from '@/common/utils/date.util';
import { parseWorkDays } from '@/common/utils/time.util';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  computeMonthlySummary,
  type MonthlySummary,
} from '@/modules/attendance/attendance-summary';
import { SettingsService } from '@/modules/settings/settings.service';
import {
  HOLIDAY_CODE,
  leaveTypeLabel,
  methodLabel,
  NO_DATA_CODE,
  STATUS_CODES,
  STATUS_LABELS,
} from './report-format';

/** Ukuran batch karyawan saat menyusun laporan (data tidak dimuat sekaligus). */
export const REPORT_BATCH_SIZE = 500;

export interface MonthlyReportRow extends MonthlySummary {
  userId: string;
  employeeCode: string;
  name: string;
  department: string | null;
}

export interface EmployeeMonth {
  row: MonthlyReportRow;
  /** Kode per tanggal (H/T/A/S/I/C/L/-/kosong) untuk sheet "Detail Harian". */
  codes: Record<string, string>;
}

export interface MonthContext {
  month: string;
  range: DateRange;
  today: string;
  holidays: Map<string, string>;
  companyName: string;
  departmentName: string | null;
}

export interface DailyReportRow {
  employeeCode: string;
  name: string;
  department: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
  method: string;
  kiosk: string;
}

export interface DailyContext {
  date: string;
  today: string;
  holidayName: string | null;
  companyName: string;
}

export interface PersonalDayRow {
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
}

export interface PersonalReport {
  context: MonthContext;
  employee: {
    employeeCode: string;
    name: string;
    department: string | null;
    position: string | null;
    shift: string | null;
  };
  summary: MonthlySummary;
  days: PersonalDayRow[];
}

const EMPLOYEE_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  position: true,
  department: { select: { name: true } },
  shift: { select: { name: true, workDays: true, isActive: true } },
} satisfies Prisma.UserSelect;

type EmployeeRow = Prisma.UserGetPayload<{ select: typeof EMPLOYEE_SELECT }>;

const RECORD_SELECT = {
  userId: true,
  date: true,
  status: true,
  lateMinutes: true,
  earlyLeaveMinutes: true,
  workMinutes: true,
  checkInAt: true,
  checkOutAt: true,
  checkInMethod: true,
  kiosk: { select: { name: true } },
} satisfies Prisma.AttendanceSelect;

type RecordRow = Prisma.AttendanceGetPayload<{ select: typeof RECORD_SELECT }>;

const workDaysOf = (employee: EmployeeRow) =>
  employee.shift?.isActive ? parseWorkDays(employee.shift.workDays) : null;

/** Data laporan rekap, harian, dan pribadi (dipakai JSON, XLSX, dan PDF). */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly settings: SettingsService,
  ) {}

  async monthContext(month: string, departmentId?: string): Promise<MonthContext> {
    const range = monthRange(month);
    const [holidays, companyName, department] = await Promise.all([
      this.prisma.holiday.findMany({
        where: { date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } },
        select: { date: true, name: true },
      }),
      this.settings.get('company.name'),
      departmentId
        ? this.prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } })
        : null,
    ]);
    if (departmentId && !department) throw fieldError('departmentId', 'Departemen tidak ditemukan');

    return {
      month,
      range,
      today: this.today(),
      holidays: new Map(holidays.map((holiday) => [fromDbDate(holiday.date), holiday.name])),
      companyName,
      departmentName: department?.name ?? null,
    };
  }

  /**
   * Rekap bulanan per karyawan, dihasilkan per batch 500 karyawan. Karyawan nonaktif
   * tetap muncul bila punya data pada bulan tersebut.
   */
  async *monthlyBatches(ctx: MonthContext, departmentId?: string): AsyncGenerator<EmployeeMonth[]> {
    const dateFilter = { gte: toDbDate(ctx.range.from), lte: toDbDate(ctx.range.to) };
    const holidaySet = new Set(ctx.holidays.keys());
    let cursor: string | undefined;

    for (;;) {
      const employees = await this.prisma.user.findMany({
        where: {
          role: 'EMPLOYEE',
          deletedAt: null,
          departmentId,
          OR: [{ isActive: true }, { attendances: { some: { date: dateFilter } } }],
        },
        orderBy: { employeeCode: 'asc' },
        take: REPORT_BATCH_SIZE,
        ...(cursor && { cursor: { employeeCode: cursor }, skip: 1 }),
        select: EMPLOYEE_SELECT,
      });
      if (employees.length === 0) return;
      cursor = employees[employees.length - 1].employeeCode;

      const records = await this.prisma.attendance.findMany({
        where: { userId: { in: employees.map((e) => e.id) }, date: dateFilter },
        select: RECORD_SELECT,
      });
      const byUser = groupBy(records, (record) => record.userId);

      yield employees.map((employee) => {
        const own = byUser.get(employee.id) ?? [];
        const workDays = workDaysOf(employee);
        const summary = computeMonthlySummary({
          records: own.map((r) => ({ ...r, date: fromDbDate(r.date) })),
          workDays,
          holidays: holidaySet,
          range: ctx.range,
          today: ctx.today,
        });
        return {
          row: {
            userId: employee.id,
            employeeCode: employee.employeeCode,
            name: employee.name,
            department: employee.department?.name ?? null,
            ...summary,
          },
          codes: this.dailyCodes(ctx, own, workDays),
        };
      });

      if (employees.length < REPORT_BATCH_SIZE) return;
    }
  }

  async monthlyRows(
    month: string,
    departmentId?: string,
  ): Promise<{ context: MonthContext; rows: MonthlyReportRow[] }> {
    const context = await this.monthContext(month, departmentId);
    const rows: MonthlyReportRow[] = [];
    for await (const batch of this.monthlyBatches(context, departmentId)) {
      rows.push(...batch.map((item) => item.row));
    }
    return { context, rows };
  }

  /** Panjang nama karyawan terpanjang — untuk lebar kolom otomatis pada XLSX streaming. */
  async longestNameLength(departmentId?: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ length: unknown }[]>`
      SELECT MAX(CHAR_LENGTH(name)) AS length FROM users
      WHERE role = 'EMPLOYEE' AND deletedAt IS NULL
      ${departmentId ? Prisma.sql`AND departmentId = ${departmentId}` : Prisma.empty}`;
    return Number(rows[0]?.length ?? 0);
  }

  async dailyContext(date: string): Promise<DailyContext> {
    const today = this.today();
    if (date > today) throw fieldError('date', 'Tanggal tidak boleh di masa depan');
    const [holiday, companyName] = await Promise.all([
      this.prisma.holiday.findUnique({ where: { date: toDbDate(date) }, select: { name: true } }),
      this.settings.get('company.name'),
    ]);
    return { date, today, holidayName: holiday?.name ?? null, companyName };
  }

  /**
   * Absensi satu hari: karyawan yang dijadwalkan (hari kerjanya) atau punya record,
   * termasuk yang belum/tidak absen.
   */
  async *dailyBatches(ctx: DailyContext): AsyncGenerator<DailyReportRow[]> {
    const day = toDbDate(ctx.date);
    let cursor: string | undefined;

    for (;;) {
      const employees = await this.prisma.user.findMany({
        where: {
          role: 'EMPLOYEE',
          deletedAt: null,
          OR: [{ isActive: true }, { attendances: { some: { date: day } } }],
        },
        orderBy: { employeeCode: 'asc' },
        take: REPORT_BATCH_SIZE,
        ...(cursor && { cursor: { employeeCode: cursor }, skip: 1 }),
        select: EMPLOYEE_SELECT,
      });
      if (employees.length === 0) return;
      cursor = employees[employees.length - 1].employeeCode;

      const ids = employees.map((e) => e.id);
      const [records, leaves] = await Promise.all([
        this.prisma.attendance.findMany({
          where: { userId: { in: ids }, date: day },
          select: RECORD_SELECT,
        }),
        this.prisma.leaveRequest.findMany({
          where: {
            userId: { in: ids },
            status: 'APPROVED',
            startDate: { lte: day },
            endDate: { gte: day },
          },
          select: { userId: true, type: true },
        }),
      ]);
      const recordByUser = new Map(records.map((r) => [r.userId, r]));
      const leaveByUser = new Map(leaves.map((l) => [l.userId, l.type]));

      const rows: DailyReportRow[] = [];
      for (const employee of employees) {
        const record = recordByUser.get(employee.id);
        const workDays = workDaysOf(employee);
        const scheduled = workDays?.includes(isoWeekday(ctx.date)) ?? false;
        if (!record && !scheduled) continue;

        rows.push({
          employeeCode: employee.employeeCode,
          name: employee.name,
          department: employee.department?.name ?? null,
          status: record
            ? STATUS_LABELS[record.status]
            : ctx.holidayName
              ? 'Libur'
              : leaveByUser.has(employee.id)
                ? leaveTypeLabel(leaveByUser.get(employee.id) ?? '')
                : ctx.date === ctx.today
                  ? 'Belum absen'
                  : 'Tidak ada data',
          checkIn: record?.checkInAt ? formatLocalTime(record.checkInAt) : '',
          checkOut: record?.checkOutAt ? formatLocalTime(record.checkOutAt) : '',
          lateMinutes: record?.lateMinutes ?? 0,
          earlyLeaveMinutes: record?.earlyLeaveMinutes ?? 0,
          workMinutes: record?.workMinutes ?? 0,
          method: methodLabel(record?.checkInMethod ?? null),
          kiosk: record?.kiosk?.name ?? '',
        });
      }
      yield rows;

      if (employees.length < REPORT_BATCH_SIZE) return;
    }
  }

  /** Laporan kehadiran pribadi satu bulan (slip kehadiran karyawan). */
  async personal(userId: string, month: string): Promise<PersonalReport> {
    const context = await this.monthContext(month);
    const employee = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: EMPLOYEE_SELECT,
    });
    if (!employee) throw notFoundError('Pengguna tidak ditemukan');

    const records = await this.prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: toDbDate(context.range.from), lte: toDbDate(context.range.to) },
      },
      select: RECORD_SELECT,
    });
    const byDate = new Map(records.map((r) => [fromDbDate(r.date), r]));
    const workDays = workDaysOf(employee);

    const days: PersonalDayRow[] = eachDate(context.range).map((date) => {
      const record = byDate.get(date);
      const isWorkDay = workDays?.includes(isoWeekday(date)) ?? false;
      const status = record
        ? STATUS_LABELS[record.status]
        : context.holidays.has(date)
          ? `Libur: ${context.holidays.get(date)}`
          : !isWorkDay
            ? 'Libur'
            : date > context.today
              ? ''
              : date === context.today
                ? 'Belum absen'
                : 'Tidak ada data';
      return {
        date,
        status,
        checkIn: record?.checkInAt ? formatLocalTime(record.checkInAt) : '',
        checkOut: record?.checkOutAt ? formatLocalTime(record.checkOutAt) : '',
        lateMinutes: record?.lateMinutes ?? 0,
        earlyLeaveMinutes: record?.earlyLeaveMinutes ?? 0,
        workMinutes: record?.workMinutes ?? 0,
      };
    });

    return {
      context,
      employee: {
        employeeCode: employee.employeeCode,
        name: employee.name,
        department: employee.department?.name ?? null,
        position: employee.position,
        shift: employee.shift?.name ?? null,
      },
      summary: computeMonthlySummary({
        records: records.map((r) => ({ ...r, date: fromDbDate(r.date) })),
        workDays,
        holidays: new Set(context.holidays.keys()),
        range: context.range,
        today: context.today,
      }),
      days,
    };
  }

  /** Waktu cetak lokal untuk footer, mis. "19/10/2026 14:05". */
  printedAt(): string {
    const now = this.clock.now();
    const [year, month, day] = toTzDateString(now).split('-');
    return `${day}/${month}/${year} ${formatLocalTime(now)}`;
  }

  private today(): string {
    return toTzDateString(this.clock.now());
  }

  private dailyCodes(
    ctx: MonthContext,
    records: RecordRow[],
    workDays: number[] | null,
  ): Record<string, string> {
    const byDate = new Map(records.map((r) => [fromDbDate(r.date), r.status]));
    const codes: Record<string, string> = {};
    for (const date of eachDate(ctx.range)) {
      const status = byDate.get(date);
      if (status) codes[date] = STATUS_CODES[status] ?? '';
      else if (ctx.holidays.has(date)) codes[date] = HOLIDAY_CODE;
      else if (workDays?.includes(isoWeekday(date)) && date < ctx.today) codes[date] = NO_DATA_CODE;
      else codes[date] = '';
    }
    return codes;
  }
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
