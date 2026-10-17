import { Injectable } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import { ErrorCode } from '@/common/constants/error-codes';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import {
  conflictError,
  type FieldError,
  fieldError,
  notFoundError,
  validationError,
} from '@/common/exceptions/error-factories';
import { isPrismaKnownRequestError } from '@/common/filters/all-exceptions.filter';
import type { PaginatedResult } from '@/common/types/api-response.type';
import type { AuthUser } from '@/common/types/auth-user.type';
import { resolveDateRange } from '@/common/utils/date-range.util';
import {
  addDays,
  combineDateAndTime,
  diffMinutes,
  fromDbDate,
  toDbDate,
  toTzDateString,
} from '@/common/utils/date.util';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import { resolveOrderBy } from '@/common/utils/sort.util';
import type { AttendanceStatus, Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { assertCanManageUser } from '@/modules/users/user-access.policy';
import { AttendanceRulesService, type ShiftRule } from './attendance-rules.service';
import { ATTENDANCE_SELECT, type AttendanceView, toAttendanceView } from './attendance.view';
import {
  ATTENDANCE_SORT_FIELDS,
  type AttendanceQueryDto,
  type CorrectAttendanceDto,
  type ManualAttendanceDto,
  type ScanLogQueryDto,
} from './dto/attendance-admin.dto';

/** Status yang berarti karyawan benar-benar masuk (punya jam). */
const WORKED_STATUSES = new Set<AttendanceStatus>(['PRESENT', 'LATE']);

const USER_BRIEF = {
  select: {
    id: true,
    name: true,
    employeeCode: true,
    department: { select: { id: true, name: true } },
  },
} as const;

const LIST_SELECT = { ...ATTENDANCE_SELECT, user: USER_BRIEF } satisfies Prisma.AttendanceSelect;

const DETAIL_SELECT = {
  ...ATTENDANCE_SELECT,
  userId: true,
  createdAt: true,
  updatedAt: true,
  user: USER_BRIEF,
  kiosk: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  scannedBy: { select: { id: true, name: true } },
  leaveRequest: { select: { id: true, type: true, status: true } },
} satisfies Prisma.AttendanceSelect;

const SCAN_LOG_SELECT = {
  id: true,
  createdAt: true,
  scanType: true,
  success: true,
  errorCode: true,
  latitude: true,
  longitude: true,
  accuracy: true,
  distance: true,
  deviceId: true,
  ipAddress: true,
  userAgent: true,
  user: { select: { id: true, name: true, employeeCode: true } },
  kiosk: { select: { id: true, name: true } },
} satisfies Prisma.AttendanceScanLogSelect;

type ListRow = Prisma.AttendanceGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.AttendanceGetPayload<{ select: typeof DETAIL_SELECT }>;
type ScanLogRow = Prisma.AttendanceScanLogGetPayload<{ select: typeof SCAN_LOG_SELECT }>;

export type AttendanceListItem = AttendanceView & { user: ListRow['user'] };

export type ScanLogView = Omit<ScanLogRow, 'latitude' | 'longitude'> & {
  latitude: number | null;
  longitude: number | null;
};

export type AttendanceDetail = AttendanceView &
  Pick<
    DetailRow,
    | 'userId'
    | 'createdAt'
    | 'updatedAt'
    | 'user'
    | 'kiosk'
    | 'location'
    | 'scannedBy'
    | 'leaveRequest'
  > & {
    shiftSnapshot: DetailRow['shiftSnapshot'];
    scanLogs: ScanLogView[];
    corrections: CorrectionView[];
  };

/** Riwayat koreksi/input manual dari audit log (terbaru dulu). */
export interface CorrectionView {
  id: string;
  action: 'ATTENDANCE_CORRECTED' | 'ATTENDANCE_MANUAL_CREATED';
  createdAt: Date;
  actor: { id: string; name: string } | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

const CORRECTION_ACTIONS = [
  AuditAction.ATTENDANCE_CORRECTED,
  AuditAction.ATTENDANCE_MANUAL_CREATED,
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

interface Metrics {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
}

const toScanLogView = ({ latitude, longitude, ...log }: ScanLogRow): ScanLogView => ({
  ...log,
  latitude: latitude?.toNumber() ?? null,
  longitude: longitude?.toNumber() ?? null,
});

/** `undefined` = tidak diubah, `null` = dihapus, string = waktu baru. */
const nextInstant = (value: string | null | undefined, current: Date | null): Date | null =>
  value === undefined ? current : value === null ? null : new Date(value);

const sameInstant = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Riwayat, detail, absensi manual & koreksi oleh admin (BUSINESS-RULES §11). */
@Injectable()
export class AttendanceAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly rules: AttendanceRulesService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: AttendanceQueryDto): Promise<PaginatedResult<AttendanceListItem>> {
    const range = resolveDateRange(query.dateFrom, query.dateTo, this.today());
    const where: Prisma.AttendanceWhereInput = {
      date: { gte: toDbDate(range.from), lte: toDbDate(range.to) },
      userId: query.userId,
      status: query.status,
      user: {
        departmentId: query.departmentId,
        ...(query.search && {
          OR: [{ name: { contains: query.search } }, { employeeCode: { contains: query.search } }],
        }),
      },
    };
    const orderBy = resolveOrderBy(query.sortBy, query.sortOrder, ATTENDANCE_SORT_FIELDS, 'date');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        orderBy,
        select: LIST_SELECT,
        ...toSkipTake(query),
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return paginate(
      rows.map(({ user, ...row }) => ({ ...toAttendanceView(row), user })),
      total,
      query,
    );
  }

  /** Detail + seluruh percobaan scan user tersebut pada tanggal yang sama. */
  async findOne(id: string): Promise<AttendanceDetail> {
    const row = await this.prisma.attendance.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!row) throw notFoundError('Data absensi tidak ditemukan');

    const date = fromDbDate(row.date);
    const logs = await this.prisma.attendanceScanLog.findMany({
      where: {
        userId: row.userId,
        createdAt: {
          gte: combineDateAndTime(date, '00:00'),
          lt: combineDateAndTime(addDays(date, 1), '00:00'),
        },
      },
      orderBy: { createdAt: 'asc' },
      select: SCAN_LOG_SELECT,
    });
    const audits = await this.prisma.auditLog.findMany({
      where: { entity: 'Attendance', entityId: id, action: { in: [...CORRECTION_ACTIONS] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
        actor: { select: { id: true, name: true } },
      },
    });

    const { userId, createdAt, updatedAt, user, scannedBy, leaveRequest, shiftSnapshot, ...base } =
      row;
    return {
      ...toAttendanceView({ ...base, shiftSnapshot }),
      userId,
      createdAt,
      updatedAt,
      user,
      scannedBy,
      leaveRequest,
      shiftSnapshot,
      scanLogs: logs.map(toScanLogView),
      corrections: audits.map((audit) => {
        const metadata = asRecord(audit.metadata);
        return {
          id: audit.id,
          action: audit.action as CorrectionView['action'],
          createdAt: audit.createdAt,
          actor: audit.actor,
          reason: typeof metadata?.reason === 'string' ? metadata.reason : null,
          before: asRecord(metadata?.before),
          after: asRecord(metadata?.after),
        };
      }),
    };
  }

  async scanLogs(query: ScanLogQueryDto): Promise<PaginatedResult<ScanLogView>> {
    const range = resolveDateRange(query.dateFrom, query.dateTo, this.today());
    const where: Prisma.AttendanceScanLogWhereInput = {
      createdAt: {
        gte: combineDateAndTime(range.from, '00:00'),
        lt: combineDateAndTime(addDays(range.to, 1), '00:00'),
      },
      success: query.success,
      userId: query.userId,
      kioskId: query.kioskId,
      errorCode: query.errorCode,
      ...(query.search && {
        user: {
          OR: [{ name: { contains: query.search } }, { employeeCode: { contains: query.search } }],
        },
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attendanceScanLog.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        select: SCAN_LOG_SELECT,
        ...toSkipTake(query),
      }),
      this.prisma.attendanceScanLog.count({ where }),
    ]);
    return paginate(rows.map(toScanLogView), total, query);
  }

  /** Record untuk karyawan yang lupa absen. Tanggal yang sudah punya record → pakai koreksi. */
  async createManual(
    dto: ManualAttendanceDto,
    actor: AuthUser,
    client: ClientInfo,
  ): Promise<AttendanceView> {
    if (dto.date > this.today()) throw fieldError('date', 'Tanggal tidak boleh di masa depan');
    // Validasi isi request (400) sebelum memeriksa bentrok data (409).
    const checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
    const checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;
    this.assertTimes(dto.date, dto.status, checkInAt, checkOutAt);

    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        shift: {
          select: {
            name: true,
            startTime: true,
            endTime: true,
            lateToleranceMinutes: true,
            checkInOpenMinutes: true,
            workDays: true,
            isActive: true,
          },
        },
      },
    });
    if (!target) throw notFoundError('Pengguna tidak ditemukan');
    assertCanManageUser(actor, target);

    const existing = await this.prisma.attendance.findUnique({
      where: { userId_date: { userId: target.id, date: toDbDate(dto.date) } },
      select: { id: true },
    });
    if (existing) {
      throw conflictError(
        'Absensi tanggal ini sudah ada; gunakan koreksi (PATCH /attendance/:id)',
        [{ field: 'date', messages: [`Sudah ada record absensi (id ${existing.id})`] }],
      );
    }

    const rule = target.shift?.isActive ? target.shift : null;
    if (WORKED_STATUSES.has(dto.status) && !rule) {
      throw new BusinessException(
        ErrorCode.NO_SHIFT_ASSIGNED,
        'Karyawan belum memiliki shift aktif',
      );
    }
    const metrics = this.computeMetrics(dto.status, rule, dto.date, checkInAt, checkOutAt);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.attendance.create({
          data: {
            userId: target.id,
            date: toDbDate(dto.date),
            status: dto.status,
            checkInAt,
            checkOutAt,
            checkInMethod: checkInAt ? 'MANUAL' : null,
            checkOutMethod: checkOutAt ? 'MANUAL' : null,
            ...metrics,
            shiftSnapshot: rule ? snapshotOf(rule) : undefined,
            note: dto.reason,
          },
          select: ATTENDANCE_SELECT,
        });
        await this.audit.log(
          {
            actorId: actor.id,
            action: AuditAction.ATTENDANCE_MANUAL_CREATED,
            entity: 'Attendance',
            entityId: created.id,
            metadata: {
              userId: target.id,
              date: dto.date,
              after: auditSnapshot(created),
              reason: dto.reason,
            },
            ip: client.ipAddress,
            userAgent: client.userAgent,
          },
          tx,
        );
        return created;
      });
      return toAttendanceView(row);
    } catch (error) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2002') {
        throw conflictError(
          'Absensi tanggal ini sudah ada; gunakan koreksi (PATCH /attendance/:id)',
        );
      }
      throw error;
    }
  }

  /**
   * Koreksi admin: metrik dihitung ulang dari `shiftSnapshot`, method sisi yang diubah menjadi
   * MANUAL, audit ATTENDANCE_CORRECTED berisi before/after/reason. Optimistic lock pada
   * `updatedAt`: bila record berubah sejak dibaca (mis. karyawan baru saja scan pulang),
   * koreksi ditolak 409 agar perubahan itu tidak tertimpa.
   */
  async correct(
    id: string,
    dto: CorrectAttendanceDto,
    actor: AuthUser,
    client: ClientInfo,
  ): Promise<AttendanceView> {
    const current = await this.prisma.attendance.findUnique({
      where: { id },
      select: {
        ...ATTENDANCE_SELECT,
        updatedAt: true,
        user: {
          select: {
            id: true,
            role: true,
            shift: {
              select: {
                name: true,
                startTime: true,
                endTime: true,
                lateToleranceMinutes: true,
                checkInOpenMinutes: true,
                workDays: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
    if (!current) throw notFoundError('Data absensi tidak ditemukan');
    assertCanManageUser(actor, current.user);

    if (
      [dto.checkInAt, dto.checkOutAt, dto.status, dto.note].every((value) => value === undefined)
    ) {
      throw validationError([
        {
          field: 'checkInAt',
          messages: ['Kirim minimal satu perubahan: checkInAt, checkOutAt, status, atau note'],
        },
      ]);
    }

    const date = fromDbDate(current.date);
    const checkInAt = nextInstant(dto.checkInAt, current.checkInAt);
    const checkOutAt = nextInstant(dto.checkOutAt, current.checkOutAt);
    const checkInChanged = !sameInstant(checkInAt, current.checkInAt);
    const checkOutChanged = !sameInstant(checkOutAt, current.checkOutAt);

    const snapshotRule = ruleFromSnapshot(current.shiftSnapshot);
    const currentRule = current.user.shift?.isActive ? current.user.shift : null;
    const rule = snapshotRule ?? currentRule;

    // Jam masuk berubah tanpa status eksplisit → PRESENT/LATE dihitung ulang (§5).
    let status: AttendanceStatus = dto.status ?? current.status;
    if (dto.status === undefined && checkInChanged && checkInAt) {
      if (!rule)
        throw new BusinessException(
          ErrorCode.NO_SHIFT_ASSIGNED,
          'Karyawan belum memiliki shift aktif',
        );
      status = this.rules.computeCheckInStatus(rule, date, checkInAt).status;
    }

    this.assertTimes(date, status, checkInAt, checkOutAt);
    if (WORKED_STATUSES.has(status) && !rule) {
      throw new BusinessException(
        ErrorCode.NO_SHIFT_ASSIGNED,
        'Karyawan belum memiliki shift aktif',
      );
    }

    const data = {
      status,
      checkInAt,
      checkOutAt,
      checkInMethod: checkInChanged ? (checkInAt ? 'MANUAL' : null) : current.checkInMethod,
      checkOutMethod: checkOutChanged ? (checkOutAt ? 'MANUAL' : null) : current.checkOutMethod,
      ...this.computeMetrics(status, rule, date, checkInAt, checkOutAt),
      note: dto.note === undefined ? current.note : dto.note,
    } satisfies Prisma.AttendanceUncheckedUpdateManyInput;

    const before = auditSnapshot(current);
    const after = auditSnapshot({ ...current, ...data });
    if (JSON.stringify(before) === JSON.stringify(after)) {
      throw validationError([{ field: 'checkInAt', messages: ['Tidak ada perubahan data'] }]);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attendance.updateMany({
        where: { id, updatedAt: current.updatedAt },
        data: {
          ...data,
          // Record lama tanpa snapshot (mis. dari cron) dibekukan dengan shift saat ini.
          ...(!snapshotRule &&
            currentRule &&
            WORKED_STATUSES.has(status) && { shiftSnapshot: snapshotOf(currentRule) }),
        },
      });
      if (count === 0) {
        throw conflictError(
          'Data absensi berubah saat dikoreksi (mis. karyawan baru saja scan). Muat ulang lalu coba lagi.',
        );
      }
      const updated = await tx.attendance.findUniqueOrThrow({
        where: { id },
        select: ATTENDANCE_SELECT,
      });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.ATTENDANCE_CORRECTED,
          entity: 'Attendance',
          entityId: id,
          metadata: { userId: current.user.id, date, before, after, reason: dto.reason },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
      return updated;
    });
    return toAttendanceView(row);
  }

  // ------------------------------------------------------------------------

  private today(): string {
    return toTzDateString(this.clock.now());
  }

  /** Konsistensi status ↔ jam: PRESENT/LATE wajib jam masuk; status lain tanpa jam. */
  private assertTimes(
    date: string,
    status: AttendanceStatus,
    checkInAt: Date | null,
    checkOutAt: Date | null,
  ): void {
    const errors: FieldError[] = [];
    const now = this.clock.now();

    if (WORKED_STATUSES.has(status)) {
      if (!checkInAt)
        errors.push({ field: 'checkInAt', messages: [`Jam masuk wajib untuk status ${status}`] });
    } else if (checkInAt || checkOutAt) {
      errors.push({
        field: checkInAt ? 'checkInAt' : 'checkOutAt',
        messages: [`Status ${status} tidak boleh memiliki jam masuk/pulang`],
      });
    }
    if (checkOutAt && !checkInAt) {
      errors.push({ field: 'checkOutAt', messages: ['Jam pulang memerlukan jam masuk'] });
    }
    for (const [field, value] of [
      ['checkInAt', checkInAt],
      ['checkOutAt', checkOutAt],
    ] as const) {
      if (!value) continue;
      if (toTzDateString(value) !== date) {
        errors.push({ field, messages: [`Waktu harus pada tanggal ${date} (waktu lokal)`] });
      } else if (value > now) {
        errors.push({ field, messages: ['Waktu tidak boleh di masa depan'] });
      }
    }
    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
      errors.push({ field: 'checkOutAt', messages: ['Jam pulang harus setelah jam masuk'] });
    }
    if (errors.length > 0) throw validationError(errors);
  }

  /**
   * §11: lateMinutes/earlyLeaveMinutes/workMinutes dihitung ulang. Status ditentukan admin:
   * PRESENT → lateMinutes 0 (keterlambatan dimaafkan); LATE → selisih dari jam masuk shift.
   */
  private computeMetrics(
    status: AttendanceStatus,
    rule: ShiftRule | null,
    date: string,
    checkInAt: Date | null,
    checkOutAt: Date | null,
  ): Metrics {
    if (!WORKED_STATUSES.has(status) || !rule || !checkInAt) {
      return { lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 0 };
    }
    const lateBy = Math.max(0, diffMinutes(checkInAt, combineDateAndTime(date, rule.startTime)));
    const checkOut = checkOutAt
      ? this.rules.computeCheckOutMetrics(rule, date, checkInAt, checkOutAt)
      : { earlyLeaveMinutes: 0, workMinutes: 0 };
    return { lateMinutes: status === 'LATE' ? lateBy : 0, ...checkOut };
  }
}

function snapshotOf(
  rule: Pick<ShiftRule, 'name' | 'startTime' | 'endTime' | 'lateToleranceMinutes'>,
) {
  return {
    name: rule.name,
    startTime: rule.startTime,
    endTime: rule.endTime,
    lateToleranceMinutes: rule.lateToleranceMinutes,
  };
}

/** Aturan dari `shiftSnapshot` (null bila snapshot tidak ada/tidak lengkap). */
function ruleFromSnapshot(snapshot: Prisma.JsonValue | null): ShiftRule | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const { name, startTime, endTime, lateToleranceMinutes } = snapshot as Record<string, unknown>;
  if (typeof startTime !== 'string' || typeof endTime !== 'string') return null;
  return {
    name: typeof name === 'string' ? name : 'Shift',
    startTime,
    endTime,
    lateToleranceMinutes: typeof lateToleranceMinutes === 'number' ? lateToleranceMinutes : 0,
    checkInOpenMinutes: 0,
    workDays: '1,2,3,4,5,6,7',
  };
}

/** Nilai yang dicatat sebagai before/after di audit (JSON-safe). */
function auditSnapshot(row: {
  status: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInMethod: string | null;
  checkOutMethod: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
  note: string | null;
}) {
  return {
    status: row.status,
    checkInAt: row.checkInAt?.toISOString() ?? null,
    checkOutAt: row.checkOutAt?.toISOString() ?? null,
    checkInMethod: row.checkInMethod,
    checkOutMethod: row.checkOutMethod,
    lateMinutes: row.lateMinutes,
    earlyLeaveMinutes: row.earlyLeaveMinutes,
    workMinutes: row.workMinutes,
    note: row.note,
  };
}
