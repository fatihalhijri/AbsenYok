import { Injectable } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import { API_PREFIX } from '@/common/constants/app.constants';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import {
  conflictError,
  fieldError,
  forbiddenError,
  notFoundError,
} from '@/common/exceptions/error-factories';
import type { PaginatedResult } from '@/common/types/api-response.type';
import type { AuthUser } from '@/common/types/auth-user.type';
import { daysInclusive } from '@/common/utils/date-range.util';
import { addDays, fromDbDate, toDbDate, toTzDateString } from '@/common/utils/date.util';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import { resolveOrderBy } from '@/common/utils/sort.util';
import { parseWorkDays } from '@/common/utils/time.util';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { SettingsService } from '@/modules/settings/settings.service';
import {
  type CreateLeaveRequestDto,
  LEAVE_SORT_FIELDS,
  type LeaveQueryDto,
  type MyLeaveQueryDto,
} from './dto/leave-request.dto';
import { type AttachmentFile, LeaveAttachmentStorage } from './leave-attachment.storage';
import { countWorkingDays } from './leave-days';

/** Maks hari ke belakang untuk `startDate` (sakit mendadak). */
export const MAX_BACKDATE_DAYS = 7;

/** Status absensi yang diisi saat izin/cuti disetujui (§5). */
export const LEAVE_ATTENDANCE_STATUS = { SICK: 'SICK', PERMIT: 'PERMIT', ANNUAL: 'LEAVE' } as const;

const LEAVE_SELECT = {
  id: true,
  userId: true,
  type: true,
  startDate: true,
  endDate: true,
  totalDays: true,
  reason: true,
  attachmentUrl: true,
  status: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: { select: { id: true, name: true } },
    },
  },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.LeaveRequestSelect;

type LeaveRow = Prisma.LeaveRequestGetPayload<{ select: typeof LEAVE_SELECT }>;

export type LeaveView = Omit<LeaveRow, 'startDate' | 'endDate' | 'attachmentUrl'> & {
  startDate: string;
  endDate: string;
  hasAttachment: boolean;
  /** Endpoint terproteksi — bukan path file. */
  attachmentUrl: string | null;
};

export interface LeaveQuota {
  year: number;
  quota: number;
  /** Total hari cuti tahunan APPROVED. */
  used: number;
  /** Total hari cuti tahunan yang masih menunggu persetujuan. */
  pending: number;
  remaining: number;
}

/** Kunci file lampiran tidak pernah dikirim ke client; diganti URL endpoint terproteksi. */
function toView({ startDate, endDate, attachmentUrl, ...row }: LeaveRow): LeaveView {
  return {
    ...row,
    startDate: fromDbDate(startDate),
    endDate: fromDbDate(endDate),
    hasAttachment: attachmentUrl !== null,
    attachmentUrl: attachmentUrl ? `/${API_PREFIX}/leave-requests/${row.id}/attachment` : null,
  };
}

const yearRange = (year: number) => ({
  gte: toDbDate(`${year}-01-01`),
  lte: toDbDate(`${year}-12-31`),
});

/** Pengajuan & persetujuan izin/sakit/cuti (BUSINESS-RULES §9). */
@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly settings: SettingsService,
    private readonly storage: LeaveAttachmentStorage,
    private readonly audit: AuditLogsService,
  ) {}

  async create(
    userId: string,
    dto: CreateLeaveRequestDto,
    file: Express.Multer.File | undefined,
  ): Promise<LeaveView> {
    const today = toTzDateString(this.clock.now());
    const range = { from: dto.startDate, to: dto.endDate };

    if (dto.startDate > dto.endDate) {
      throw fieldError('endDate', 'Tanggal selesai tidak boleh sebelum tanggal mulai');
    }
    if (dto.startDate < addDays(today, -MAX_BACKDATE_DAYS)) {
      throw fieldError(
        'startDate',
        `Tanggal mulai paling lambat ${MAX_BACKDATE_DAYS} hari ke belakang`,
      );
    }
    const maxRangeDays = await this.settings.get('leave.maxRangeDays');
    if (daysInclusive(dto.startDate, dto.endDate) > maxRangeDays) {
      throw fieldError('endDate', `Rentang pengajuan maksimal ${maxRangeDays} hari`);
    }
    if (dto.type === 'ANNUAL' && dto.startDate.slice(0, 4) !== dto.endDate.slice(0, 4)) {
      throw fieldError(
        'endDate',
        'Cuti tahunan tidak boleh melewati pergantian tahun; ajukan terpisah per tahun',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { shift: { select: { workDays: true, isActive: true } } },
    });
    const workDays = user?.shift?.isActive ? parseWorkDays(user.shift.workDays) : null;
    if (!workDays) throw new BusinessException(ErrorCode.NO_SHIFT_ASSIGNED);

    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: toDbDate(dto.startDate), lte: toDbDate(dto.endDate) } },
      select: { date: true },
    });
    const totalDays = countWorkingDays(
      range,
      workDays,
      new Set(holidays.map((h) => fromDbDate(h.date))),
    );
    if (totalDays === 0) throw fieldError('startDate', 'Rentang tanggal tidak mencakup hari kerja');

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: toDbDate(dto.endDate) },
        endDate: { gte: toDbDate(dto.startDate) },
      },
      select: { id: true, type: true, status: true, startDate: true, endDate: true },
    });
    if (overlap) {
      throw conflictError('Tanggal bertabrakan dengan pengajuan lain', [
        {
          field: 'startDate',
          messages: [
            `Bertabrakan dengan pengajuan ${overlap.type} ${fromDbDate(overlap.startDate)} s/d ${fromDbDate(
              overlap.endDate,
            )} (${overlap.status}, id ${overlap.id})`,
          ],
        },
      ]);
    }

    const attachment = file ? await this.storage.validate(file) : null;
    if (dto.type === 'SICK' && totalDays > 1 && !attachment) {
      throw fieldError('attachment', 'Sakit lebih dari 1 hari wajib melampirkan surat dokter');
    }

    if (dto.type === 'ANNUAL') {
      const quota = await this.quota(userId, Number(dto.startDate.slice(0, 4)));
      const available = quota.quota - quota.used - quota.pending;
      if (totalDays > available) {
        throw fieldError(
          'type',
          `Sisa cuti tahunan tidak cukup: tersedia ${Math.max(0, available)} hari ` +
            `(termasuk pengajuan yang menunggu), diajukan ${totalDays} hari`,
        );
      }
    }

    // File disimpan setelah semua validasi lolos; dihapus lagi bila penyimpanan DB gagal.
    const key = attachment ? await this.storage.save(attachment) : null;
    try {
      const row = await this.prisma.leaveRequest.create({
        data: {
          userId,
          type: dto.type,
          startDate: toDbDate(dto.startDate),
          endDate: toDbDate(dto.endDate),
          totalDays,
          reason: dto.reason,
          attachmentUrl: key,
        },
        select: LEAVE_SELECT,
      });
      return toView(row);
    } catch (error) {
      if (key) await this.storage.remove(key);
      throw error;
    }
  }

  async myList(userId: string, query: MyLeaveQueryDto): Promise<LeaveView[]> {
    const year = query.year ?? this.currentYear();
    const rows = await this.prisma.leaveRequest.findMany({
      where: { userId, status: query.status, startDate: yearRange(year) },
      orderBy: { startDate: 'desc' },
      select: LEAVE_SELECT,
    });
    return rows.map(toView);
  }

  /** `used` = total hari ANNUAL yang APPROVED pada tahun tersebut (§9). */
  async quota(userId: string, year: number = this.currentYear()): Promise<LeaveQuota> {
    const [quota, grouped] = await Promise.all([
      this.settings.get('leave.annualQuota'),
      this.prisma.leaveRequest.groupBy({
        by: ['status'],
        where: {
          userId,
          type: 'ANNUAL',
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: yearRange(year),
        },
        _sum: { totalDays: true },
      }),
    ]);
    const sumOf = (status: string) => grouped.find((g) => g.status === status)?._sum.totalDays ?? 0;
    const used = sumOf('APPROVED');
    return { year, quota, used, pending: sumOf('PENDING'), remaining: Math.max(0, quota - used) };
  }

  async cancel(userId: string, id: string): Promise<LeaveView> {
    const leave = await this.findRow(id);
    if (leave.userId !== userId)
      throw forbiddenError('Anda hanya dapat membatalkan pengajuan sendiri');
    this.assertPending(leave.status, 'dibatalkan');

    const { count } = await this.prisma.leaveRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) this.assertPending('CHANGED', 'dibatalkan');
    return toView(await this.findRow(id));
  }

  /**
   * Setujui pengajuan. Dalam transaksi yang sama, absensi ABSENT (tanpa check-in) pada tanggal
   * yang tercakup & sudah lewat diubah menjadi SICK/PERMIT/LEAVE (§9). Tanggal mendatang diisi cron.
   */
  async approve(
    id: string,
    actor: AuthUser,
    note: string | undefined,
    client: ClientInfo,
  ): Promise<LeaveView> {
    const leave = await this.findRow(id);
    this.assertPending(leave.status, 'disetujui');

    if (leave.type === 'ANNUAL') {
      const quota = await this.quota(leave.userId, Number(fromDbDate(leave.startDate).slice(0, 4)));
      if (quota.used + leave.totalDays > quota.quota) {
        throw conflictError(
          `Kuota cuti tahunan karyawan tidak cukup (terpakai ${quota.used} dari ${quota.quota} hari)`,
        );
      }
    }

    const now = this.clock.now();
    const today = toTzDateString(now);
    const lastPastDate = fromDbDate(leave.endDate) < today ? fromDbDate(leave.endDate) : today;
    const status = LEAVE_ATTENDANCE_STATUS[leave.type];

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedById: actor.id,
          reviewedAt: now,
          reviewNote: note ?? null,
        },
      });
      if (count === 0) this.assertPending('CHANGED', 'disetujui');

      const converted =
        fromDbDate(leave.startDate) <= lastPastDate
          ? await tx.attendance.updateMany({
              where: {
                userId: leave.userId,
                date: { gte: leave.startDate, lte: toDbDate(lastPastDate) },
                status: 'ABSENT',
                checkInAt: null,
              },
              data: {
                status,
                leaveRequestId: id,
                lateMinutes: 0,
                earlyLeaveMinutes: 0,
                workMinutes: 0,
              },
            })
          : { count: 0 };

      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.LEAVE_APPROVED,
          entity: 'LeaveRequest',
          entityId: id,
          metadata: {
            userId: leave.userId,
            type: leave.type,
            startDate: fromDbDate(leave.startDate),
            endDate: fromDbDate(leave.endDate),
            totalDays: leave.totalDays,
            convertedAttendances: converted.count,
            note: note ?? null,
          },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
    });
    return toView(await this.findRow(id));
  }

  async reject(id: string, actor: AuthUser, note: string, client: ClientInfo): Promise<LeaveView> {
    const leave = await this.findRow(id);
    this.assertPending(leave.status, 'ditolak');
    const now = this.clock.now();

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', reviewedById: actor.id, reviewedAt: now, reviewNote: note },
      });
      if (count === 0) this.assertPending('CHANGED', 'ditolak');
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.LEAVE_REJECTED,
          entity: 'LeaveRequest',
          entityId: id,
          metadata: {
            userId: leave.userId,
            type: leave.type,
            startDate: fromDbDate(leave.startDate),
            endDate: fromDbDate(leave.endDate),
            note,
          },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
    });
    return toView(await this.findRow(id));
  }

  async adminList(query: LeaveQueryDto): Promise<PaginatedResult<LeaveView>> {
    const where: Prisma.LeaveRequestWhereInput = {
      status: query.status,
      type: query.type,
      userId: query.userId,
      // Pengajuan yang beririsan dengan [dateFrom, dateTo].
      ...(query.dateTo && { startDate: { lte: toDbDate(query.dateTo) } }),
      ...(query.dateFrom && { endDate: { gte: toDbDate(query.dateFrom) } }),
      user: {
        departmentId: query.departmentId,
        ...(query.search && {
          OR: [{ name: { contains: query.search } }, { employeeCode: { contains: query.search } }],
        }),
      },
    };
    const orderBy = resolveOrderBy(query.sortBy, query.sortOrder, LEAVE_SORT_FIELDS, 'createdAt');
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        orderBy,
        select: LEAVE_SELECT,
        ...toSkipTake(query),
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return paginate(rows.map(toView), total, query);
  }

  /** Detail: admin, atau karyawan pemilik pengajuan. */
  async findOne(id: string, actor: AuthUser): Promise<LeaveView> {
    const row = await this.findRow(id);
    this.assertCanView(row.userId, actor);
    return toView(row);
  }

  async attachment(id: string, actor: AuthUser): Promise<AttachmentFile> {
    const row = await this.prisma.leaveRequest.findUnique({
      where: { id },
      select: { userId: true, attachmentUrl: true },
    });
    if (!row) throw notFoundError('Pengajuan tidak ditemukan');
    this.assertCanView(row.userId, actor);
    if (!row.attachmentUrl) throw notFoundError('Pengajuan ini tidak memiliki lampiran');
    return this.storage.open(row.attachmentUrl);
  }

  // ------------------------------------------------------------------------

  private async findRow(id: string): Promise<LeaveRow> {
    const row = await this.prisma.leaveRequest.findUnique({ where: { id }, select: LEAVE_SELECT });
    if (!row) throw notFoundError('Pengajuan tidak ditemukan');
    return row;
  }

  private assertCanView(ownerId: string, actor: AuthUser): void {
    if (actor.role === Role.EMPLOYEE && actor.id !== ownerId) {
      throw forbiddenError('Anda tidak memiliki akses ke pengajuan ini');
    }
  }

  private assertPending(status: string, action: string): void {
    if (status !== 'PENDING') {
      throw conflictError(`Hanya pengajuan berstatus PENDING yang dapat ${action}`);
    }
  }

  private currentYear(): number {
    return Number(toTzDateString(this.clock.now()).slice(0, 4));
  }
}
