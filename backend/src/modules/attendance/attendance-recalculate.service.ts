import { Injectable } from '@nestjs/common';
import { addDays, combineDateAndTime, toDbDate } from '@/common/utils/date.util';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AttendanceRulesService } from './attendance-rules.service';

export const DAILY_CRON_LOCK = 'absenyok_daily_cron';
export const RECALCULATE_BATCH_SIZE = 500;
/** Batas waktu transaksi penahan lock (proses besar tetap punya batas). */
const LOCK_HOLD_TIMEOUT_MS = 15 * 60_000;

export interface RecalculateResult {
  date: string;
  /** Karyawan yang dievaluasi (aktif, punya shift, hari kerjanya). */
  processed: number;
  /** Record baru (ABSENT atau SICK/PERMIT/LEAVE). */
  created: number;
  /** Record tanpa check-in yang diubah ke status cuti/izin. */
  updated: number;
  /** Alasan tanggal dilewati seluruhnya (mis. HOLIDAY). */
  skipped: 'HOLIDAY' | null;
  durationMs: number;
}

export type LockedOutcome<T> = { acquired: true; result: T } | { acquired: false };

const LEAVE_STATUS = { SICK: 'SICK', PERMIT: 'PERMIT', ANNUAL: 'LEAVE' } as const;

/**
 * Penandaan harian BUSINESS-RULES §10 (cron 23:55 & `POST /attendance/recalculate`).
 * Idempoten: hanya mengisi yang belum ada dan tidak pernah menimpa record yang sudah check-in.
 */
@Injectable()
export class AttendanceRecalculateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: AttendanceRulesService,
  ) {}

  async run(date: string): Promise<RecalculateResult> {
    const startedAt = Date.now();
    const result: RecalculateResult = {
      date,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: null,
      durationMs: 0,
    };

    const holiday = await this.prisma.holiday.findUnique({
      where: { date: toDbDate(date) },
      select: { id: true },
    });
    if (holiday) {
      return { ...result, skipped: 'HOLIDAY', durationMs: Date.now() - startedAt };
    }

    // Karyawan yang baru dibuat setelah tanggal tersebut tidak ditandai ABSENT.
    const endOfDay = combineDateAndTime(addDays(date, 1), '00:00');
    let cursor: string | undefined;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          role: 'EMPLOYEE',
          isActive: true,
          deletedAt: null,
          createdAt: { lt: endOfDay },
          shift: { isActive: true },
        },
        orderBy: { id: 'asc' },
        take: RECALCULATE_BATCH_SIZE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          shift: {
            select: {
              name: true,
              startTime: true,
              endTime: true,
              lateToleranceMinutes: true,
              workDays: true,
            },
          },
        },
      });
      if (users.length === 0) break;
      cursor = users[users.length - 1].id;

      const batch = await this.processBatch(date, users);
      result.processed += batch.processed;
      result.created += batch.created;
      result.updated += batch.updated;

      if (users.length < RECALCULATE_BATCH_SIZE) break;
    }

    return { ...result, durationMs: Date.now() - startedAt };
  }

  /**
   * Jalankan `fn` hanya bila lock MySQL `GET_LOCK` didapat (cegah eksekusi ganda antar instance).
   * Lock bersifat per koneksi, sehingga diambil & dilepas di transaksi interaktif yang menahan
   * satu koneksi; pekerjaan sendiri berjalan di koneksi lain dari pool.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<LockedOutcome<T>> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ acquired: unknown }[]>`
          SELECT GET_LOCK(${DAILY_CRON_LOCK}, 0) AS acquired`;
        if (Number(rows[0]?.acquired) !== 1) return { acquired: false } as const;
        try {
          return { acquired: true, result: await fn() } as const;
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${DAILY_CRON_LOCK})`;
        }
      },
      { timeout: LOCK_HOLD_TIMEOUT_MS, maxWait: 10_000 },
    );
  }

  private async processBatch(
    date: string,
    users: {
      id: string;
      shift: {
        name: string;
        startTime: string;
        endTime: string;
        lateToleranceMinutes: number;
        workDays: string;
      } | null;
    }[],
  ): Promise<{ processed: number; created: number; updated: number }> {
    const working = users.filter((user) => user.shift && this.rules.isWorkingDay(user.shift, date));
    if (working.length === 0) return { processed: 0, created: 0, updated: 0 };

    const day = toDbDate(date);
    const ids = working.map((user) => user.id);
    const [records, leaves] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { userId: { in: ids }, date: day },
        select: { id: true, userId: true, status: true, checkInAt: true, leaveRequestId: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId: { in: ids },
          status: 'APPROVED',
          startDate: { lte: day },
          endDate: { gte: day },
        },
        select: { id: true, userId: true, type: true },
      }),
    ]);
    const recordByUser = new Map(records.map((record) => [record.userId, record]));
    const leaveByUser = new Map(leaves.map((leave) => [leave.userId, leave]));

    const creates: Prisma.AttendanceCreateManyInput[] = [];
    const updates: Prisma.PrismaPromise<unknown>[] = [];

    for (const user of working) {
      const record = recordByUser.get(user.id);
      const leave = leaveByUser.get(user.id);
      const shiftSnapshot = user.shift
        ? {
            name: user.shift.name,
            startTime: user.shift.startTime,
            endTime: user.shift.endTime,
            lateToleranceMinutes: user.shift.lateToleranceMinutes,
          }
        : undefined;

      if (leave) {
        const status = LEAVE_STATUS[leave.type];
        if (!record) {
          creates.push({
            userId: user.id,
            date: day,
            status,
            leaveRequestId: leave.id,
            shiftSnapshot,
          });
        } else if (
          !record.checkInAt &&
          (record.status !== status || record.leaveRequestId !== leave.id)
        ) {
          // Mis. sudah ABSENT lalu izin disetujui belakangan (§9) → ubah langsung.
          updates.push(
            this.prisma.attendance.update({
              where: { id: record.id },
              data: {
                status,
                leaveRequestId: leave.id,
                lateMinutes: 0,
                earlyLeaveMinutes: 0,
                workMinutes: 0,
              },
            }),
          );
        }
      } else if (!record) {
        creates.push({ userId: user.id, date: day, status: 'ABSENT', shiftSnapshot });
      }
    }

    const { count } = creates.length
      ? await this.prisma.attendance.createMany({ data: creates, skipDuplicates: true })
      : { count: 0 };
    if (updates.length) await this.prisma.$transaction(updates);

    return { processed: working.length, created: count, updated: updates.length };
  }
}
