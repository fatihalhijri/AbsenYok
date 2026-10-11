import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuditAction } from './audit-action';

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

  constructor(private readonly prisma: PrismaService) {}

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
