import { Injectable } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import { monthRange } from '@/common/utils/date-range.util';
import { fromDbDate, toDbDate, toTzDateString } from '@/common/utils/date.util';
import { parseWorkDays } from '@/common/utils/time.util';
import { PrismaService } from '@/prisma/prisma.service';
import { computeMonthlySummary, type MonthlySummary } from './attendance-summary';
import { ATTENDANCE_SELECT, type AttendanceView, toAttendanceView } from './attendance.view';

export interface MonthlyAttendance {
  month: string;
  items: AttendanceView[];
  summary: MonthlySummary;
}

/** Riwayat absensi karyawan per bulan (halaman riwayat aplikasi karyawan). */
@Injectable()
export class AttendanceHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async myMonth(userId: string, month?: string): Promise<MonthlyAttendance> {
    const today = toTzDateString(this.clock.now());
    const selectedMonth = month ?? today.slice(0, 7);
    const range = monthRange(selectedMonth);
    const dateFilter = { gte: toDbDate(range.from), lte: toDbDate(range.to) };

    const [rows, user, holidays] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { userId, date: dateFilter },
        orderBy: { date: 'asc' },
        select: ATTENDANCE_SELECT,
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, shift: { select: { workDays: true, isActive: true } } },
      }),
      this.prisma.holiday.findMany({ where: { date: dateFilter }, select: { date: true } }),
    ]);

    const items = rows.map(toAttendanceView);
    const shift = user?.shift?.isActive ? user.shift : null;
    return {
      month: selectedMonth,
      items,
      summary: computeMonthlySummary({
        records: items,
        workDays: shift ? parseWorkDays(shift.workDays) : null,
        holidays: new Set(holidays.map((holiday) => fromDbDate(holiday.date))),
        range,
        today,
        joinedOn: user ? toTzDateString(user.createdAt) : null,
      }),
    };
  }
}
