import { Injectable, Logger } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { resolveDateRange } from '@/common/utils/date-range.util';
import { addDays, combineDateAndTime, toTzDateString } from '@/common/utils/date.util';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuditAction } from './audit-action';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';

const AUDIT_SELECT = {
  id: true,
  action: true,
  entity: true,
  entityId: true,
  metadata: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  actor: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditLogView = Prisma.AuditLogGetPayload<{ select: typeof AUDIT_SELECT }>;

export interface AuditLogEntry {
  actorId?: string | null;
  action: AuditAction;
  /** Nama entitas yang terdampak, mis. `User`, `RefreshToken`, `Attendance`. */
  entity: string;
  entityId?: string | null;
  /** `{ before, after, reason, ... }` — JANGAN memasukkan password/token. */
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Daftar audit (SUPER_ADMIN) — terbaru lebih dulu, rentang maks 92 hari. */
  async list(query: AuditLogQueryDto): Promise<PaginatedResult<AuditLogView>> {
    const range = resolveDateRange(query.dateFrom, query.dateTo, toTzDateString(this.clock.now()));
    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      actorId: query.actorId,
      entity: query.entity,
      entityId: query.entityId,
      createdAt: {
        gte: combineDateAndTime(range.from, '00:00'),
        lt: combineDateAndTime(addDays(range.to, 1), '00:00'),
      },
      ...(query.search && {
        actor: {
          OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }],
        },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        select: AUDIT_SELECT,
        ...toSkipTake(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(rows, total, query);
  }

  /**
   * Catat aktivitas sensitif.
   * - Dengan `tx`: menjadi bagian transaksi (gagal → transaksi dibatalkan).
   * - Tanpa `tx`: kegagalan hanya dicatat ke log agar alur utama tidak terganggu.
   */
  async log(entry: AuditLogEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
      ipAddress: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    };

    if (tx) {
      await tx.auditLog.create({ data });
      return;
    }

    try {
      await this.prisma.auditLog.create({ data });
    } catch (error) {
      this.logger.error(
        `Gagal mencatat audit ${entry.action} (${entry.entity}:${entry.entityId ?? '-'})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
