import { toDbDate } from '@/common/utils/date.util';
import type { Prisma } from '@/generated/prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

export type AttendanceFactoryInput = { userId: string; date: string } & Partial<
  Omit<Prisma.AttendanceUncheckedCreateInput, 'userId' | 'date'>
>;

/** Record absensi pada tanggal lokal `YYYY-MM-DD` (default status ABSENT tanpa jam). */
export function createAttendance(prisma: PrismaService, { date, ...data }: AttendanceFactoryInput) {
  return prisma.attendance.create({
    data: { status: 'ABSENT', ...data, date: toDbDate(date) },
  });
}
