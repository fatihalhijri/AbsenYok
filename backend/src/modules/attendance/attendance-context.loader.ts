import { Injectable } from '@nestjs/common';
import { toDbDate } from '@/common/utils/date.util';
import { PrismaService } from '@/prisma/prisma.service';
import { ATTENDANCE_SELECT, type AttendanceRow } from './attendance.view';

const SHIFT_SELECT = {
  id: true,
  name: true,
  startTime: true,
  endTime: true,
  lateToleranceMinutes: true,
  checkInOpenMinutes: true,
  workDays: true,
  isActive: true,
} as const;

export interface ContextUser {
  id: string;
  name: string;
  employeeCode: string;
  isActive: boolean;
  deletedAt: Date | null;
  boundDeviceId: string | null;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    lateToleranceMinutes: number;
    checkInOpenMinutes: number;
    workDays: string;
    isActive: boolean;
  } | null;
}

export interface AttendanceContext {
  /** Tanggal lokal APP_TIMEZONE (YYYY-MM-DD). */
  date: string;
  user: ContextUser | null;
  holiday: { id: string; date: Date; name: string } | null;
  leave: { id: string; type: 'SICK' | 'PERMIT' | 'ANNUAL'; startDate: Date; endDate: Date } | null;
  attendance: AttendanceRow | null;
}

/** Semua data yang dibutuhkan validasi scan & kartu beranda, dimuat paralel. */
@Injectable()
export class AttendanceContextLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string, date: string): Promise<AttendanceContext> {
    const day = toDbDate(date);
    const [user, holiday, leave, attendance] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          employeeCode: true,
          isActive: true,
          deletedAt: true,
          boundDeviceId: true,
          shift: { select: SHIFT_SELECT },
        },
      }),
      this.prisma.holiday.findUnique({
        where: { date: day },
        select: { id: true, date: true, name: true },
      }),
      this.prisma.leaveRequest.findFirst({
        where: { userId, status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } },
        select: { id: true, type: true, startDate: true, endDate: true },
      }),
      this.prisma.attendance.findUnique({
        where: { userId_date: { userId, date: day } },
        select: ATTENDANCE_SELECT,
      }),
    ]);
    return { date, user, holiday, leave, attendance };
  }
}
