import { Injectable } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import { eachDate, monthRange } from '@/common/utils/date-range.util';
import {
  addDays,
  fromDbDate,
  isoWeekday,
  toDbDate,
  toTzDateString,
} from '@/common/utils/date.util';
import { parseWorkDays } from '@/common/utils/time.util';
import { PrismaService } from '@/prisma/prisma.service';

const LEAVE_STATUSES = new Set(['SICK', 'PERMIT', 'LEAVE']);
const RECENT_LIMIT = 20;
const RANKING_LIMIT = 10;

export interface DashboardSummary {
  date: string;
  /** EMPLOYEE aktif dengan shift aktif yang hari ini hari kerjanya (0 bila hari libur). */
  totalEmployees: number;
  present: number;
  late: number;
  /** Hanya terisi setelah cron 23:55 (atau recalculate); sebelumnya lihat `notYetCheckedIn`. */
  absent: number;
  /** Record SICK/PERMIT/LEAVE + cuti disetujui hari ini yang belum punya record. */
  onLeave: number;
  notYetCheckedIn: number;
  attendanceRate: number;
  holiday: { name: string } | null;
}

export interface TrendPoint {
  date: string;
  present: number;
  late: number;
  absent: number;
  /** SICK + PERMIT + LEAVE */
  leave: number;
}

export interface LateRankingItem {
  rank: number;
  user: {
    id: string;
    name: string;
    employeeCode: string;
    avatarUrl: string | null;
    department: string | null;
  };
  lateCount: number;
  totalLateMinutes: number;
}

export interface RecentActivity {
  attendanceId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  time: Date;
  status: string;
  method: string | null;
  kiosk: { id: string; name: string } | null;
  user: { id: string; name: string; employeeCode: string; avatarUrl: string | null };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Statistik ringkas admin (hari ini & tren) dalam zona APP_TIMEZONE. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async summary(): Promise<DashboardSummary> {
    const date = this.today();
    const day = toDbDate(date);

    const [holiday, employees] = await Promise.all([
      this.prisma.holiday.findUnique({ where: { date: day }, select: { name: true } }),
      this.prisma.user.findMany({
        where: { role: 'EMPLOYEE', isActive: true, deletedAt: null, shift: { isActive: true } },
        select: { id: true, shift: { select: { workDays: true } } },
      }),
    ]);
    const weekday = isoWeekday(date);
    const scheduledIds = holiday
      ? []
      : employees
          .filter((employee) => parseWorkDays(employee.shift?.workDays ?? '')?.includes(weekday))
          .map((employee) => employee.id);

    const [records, leaves] = scheduledIds.length
      ? await Promise.all([
          this.prisma.attendance.findMany({
            where: { date: day, userId: { in: scheduledIds } },
            select: { userId: true, status: true },
          }),
          this.prisma.leaveRequest.findMany({
            where: {
              userId: { in: scheduledIds },
              status: 'APPROVED',
              startDate: { lte: day },
              endDate: { gte: day },
            },
            select: { userId: true },
            distinct: ['userId'],
          }),
        ])
      : [[], []];

    const count = (status: string) => records.filter((record) => record.status === status).length;
    const withRecord = new Set(records.map((record) => record.userId));
    const present = count('PRESENT');
    const late = count('LATE');
    const absent = count('ABSENT');
    const onLeave =
      records.filter((record) => LEAVE_STATUSES.has(record.status)).length +
      leaves.filter((leave) => !withRecord.has(leave.userId)).length;
    const totalEmployees = scheduledIds.length;

    return {
      date,
      totalEmployees,
      present,
      late,
      absent,
      onLeave,
      notYetCheckedIn: Math.max(0, totalEmployees - present - late - absent - onLeave),
      attendanceRate: totalEmployees ? round1(((present + late) / totalEmployees) * 100) : 0,
      holiday: holiday ? { name: holiday.name } : null,
    };
  }

  /** Jumlah per status per tanggal (`groupBy(['date','status'])`), tanggal kosong = 0. */
  async trend(days: number): Promise<TrendPoint[]> {
    const to = this.today();
    const from = addDays(to, -(days - 1));
    const groups = await this.prisma.attendance.groupBy({
      by: ['date', 'status'],
      where: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
      _count: { _all: true },
    });

    const points = new Map<string, TrendPoint>(
      eachDate({ from, to }).map((date) => [
        date,
        { date, present: 0, late: 0, absent: 0, leave: 0 },
      ]),
    );
    for (const group of groups) {
      const point = points.get(fromDbDate(group.date));
      if (!point) continue;
      const total = group._count._all;
      if (group.status === 'PRESENT') point.present += total;
      else if (group.status === 'LATE') point.late += total;
      else if (group.status === 'ABSENT') point.absent += total;
      else point.leave += total;
    }
    return [...points.values()];
  }

  /** Top 10 akumulasi menit terlambat + frekuensi terlambat dalam sebulan. */
  async lateRanking(month?: string): Promise<LateRankingItem[]> {
    const range = monthRange(month ?? this.today().slice(0, 7));
    const groups = await this.prisma.attendance.groupBy({
      by: ['userId'],
      where: { status: 'LATE', date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } },
      _sum: { lateMinutes: true },
      _count: { _all: true },
      orderBy: [{ _sum: { lateMinutes: 'desc' } }, { userId: 'asc' }],
      take: RANKING_LIMIT,
    });
    if (groups.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: groups.map((group) => group.userId) } },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        avatarUrl: true,
        department: { select: { name: true } },
      },
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return groups.flatMap((group, index) => {
      const user = byId.get(group.userId);
      if (!user) return [];
      return [
        {
          rank: index + 1,
          user: {
            id: user.id,
            name: user.name,
            employeeCode: user.employeeCode,
            avatarUrl: user.avatarUrl,
            department: user.department?.name ?? null,
          },
          lateCount: group._count._all,
          totalLateMinutes: group._sum.lateMinutes ?? 0,
        },
      ];
    });
  }

  /** 20 kejadian masuk/pulang terbaru hari ini (termasuk QR personal & manual). */
  async recentActivity(): Promise<RecentActivity[]> {
    const day = toDbDate(this.today());
    const select = {
      id: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      checkInMethod: true,
      checkOutMethod: true,
      kiosk: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, employeeCode: true, avatarUrl: true } },
    } as const;

    const [checkIns, checkOuts] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { date: day, checkInAt: { not: null } },
        orderBy: { checkInAt: 'desc' },
        take: RECENT_LIMIT,
        select,
      }),
      this.prisma.attendance.findMany({
        where: { date: day, checkOutAt: { not: null } },
        orderBy: { checkOutAt: 'desc' },
        take: RECENT_LIMIT,
        select,
      }),
    ]);

    const events: RecentActivity[] = [
      ...checkIns.map((row) => ({
        attendanceId: row.id,
        type: 'CHECK_IN' as const,
        time: row.checkInAt as Date,
        status: row.status,
        method: row.checkInMethod,
        kiosk: row.kiosk,
        user: row.user,
      })),
      ...checkOuts.map((row) => ({
        attendanceId: row.id,
        type: 'CHECK_OUT' as const,
        time: row.checkOutAt as Date,
        status: row.status,
        method: row.checkOutMethod,
        kiosk: row.kiosk,
        user: row.user,
      })),
    ];
    return events.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, RECENT_LIMIT);
  }

  private today(): string {
    return toTzDateString(this.clock.now());
  }
}
