import { toDbDate } from '@/common/utils/date.util';
import type { Prisma } from '@/generated/prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

export type LeaveRequestFactoryInput = {
  userId: string;
  startDate: string;
  endDate?: string;
} & Partial<Omit<Prisma.LeaveRequestUncheckedCreateInput, 'userId' | 'startDate' | 'endDate'>>;

/**
 * Pengajuan izin langsung di database (default SICK 1 hari, APPROVED). `totalDays` tidak
 * dihitung ulang — isi sesuai skenario test.
 */
export function createLeaveRequest(
  prisma: PrismaService,
  { startDate, endDate = startDate, ...data }: LeaveRequestFactoryInput,
) {
  return prisma.leaveRequest.create({
    data: {
      type: 'SICK',
      totalDays: 1,
      reason: 'Demam',
      status: 'APPROVED',
      ...data,
      startDate: toDbDate(startDate),
      endDate: toDbDate(endDate),
    },
  });
}
