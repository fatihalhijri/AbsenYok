import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import { ErrorCode } from '@/common/constants/error-codes';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import { conflictError, fieldError, notFoundError } from '@/common/exceptions/error-factories';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { combineDateAndTime, toDbDate, toTzDateString } from '@/common/utils/date.util';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import { resolveOrderBy } from '@/common/utils/sort.util';
import { AppConfigService } from '@/config/app.config';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { KioskCacheService } from '@/modules/qr/kiosk-cache.service';
import { QrService } from '@/modules/qr/qr.service';
import {
  type CreateKioskDto,
  KIOSK_SORT_FIELDS,
  type KioskQueryDto,
  type UpdateKioskDto,
} from './dto/kiosk.dto';

/** Select aman: `secret` TIDAK PERNAH dipilih untuk respons. */
const KIOSK_SELECT = {
  id: true,
  name: true,
  qrIntervalSeconds: true,
  isActive: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  location: { select: { id: true, name: true } },
} satisfies Prisma.KioskSelect;

export type KioskView = Prisma.KioskGetPayload<{ select: typeof KIOSK_SELECT }>;

export interface KioskQr {
  token: string;
  expiresAt: Date;
  intervalSeconds: number;
  serverTime: Date;
  kiosk: { id: string; name: string; locationName: string };
}

export interface RecentScan {
  id: string;
  name: string;
  employeeCode: string;
  avatarUrl: string | null;
  type: 'CHECK_IN' | 'CHECK_OUT';
  time: Date;
  status: string | null;
}

const SECRET_BYTES = 64;
const RECENT_SCAN_LIMIT = 10;
/** `lastSeenAt` ditulis paling sering sekali per menit per kiosk. */
const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

const newSecret = () => randomBytes(SECRET_BYTES).toString('hex');

@Injectable()
export class KiosksService {
  private readonly logger = new Logger(KiosksService.name);
  private readonly lastSeenWrittenAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
    private readonly kioskCache: KioskCacheService,
    private readonly audit: AuditLogsService,
    private readonly config: AppConfigService,
    private readonly clock: ClockService,
  ) {}

  async list(query: KioskQueryDto): Promise<PaginatedResult<KioskView>> {
    const where: Prisma.KioskWhereInput = {
      locationId: query.locationId,
      isActive: query.isActive,
      ...(query.search && { name: { contains: query.search } }),
    };
    const orderBy = resolveOrderBy(query.sortBy, query.sortOrder, KIOSK_SORT_FIELDS, 'name');
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.kiosk.findMany({ where, orderBy, select: KIOSK_SELECT, ...toSkipTake(query) }),
      this.prisma.kiosk.count({ where }),
    ]);
    return paginate(rows, total, query);
  }

  async findOne(id: string): Promise<KioskView> {
    const row = await this.prisma.kiosk.findUnique({ where: { id }, select: KIOSK_SELECT });
    if (!row) throw notFoundError('Kiosk tidak ditemukan');
    return row;
  }

  async create(dto: CreateKioskDto): Promise<KioskView> {
    await this.assertActiveLocation(dto.locationId);
    return this.prisma.kiosk.create({
      data: {
        name: dto.name,
        locationId: dto.locationId,
        qrIntervalSeconds: dto.qrIntervalSeconds ?? this.config.get('QR_KIOSK_INTERVAL_SECONDS'),
        secret: newSecret(),
      },
      select: KIOSK_SELECT,
    });
  }

  async update(id: string, dto: UpdateKioskDto): Promise<KioskView> {
    await this.findOne(id);
    if (dto.locationId) await this.assertActiveLocation(dto.locationId);
    const row = await this.prisma.kiosk.update({ where: { id }, data: dto, select: KIOSK_SELECT });
    this.kioskCache.invalidate(id);
    return row;
  }

  /** Ditolak bila sudah punya riwayat absensi (nonaktifkan saja agar jejak histori tetap utuh). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const attendances = await this.prisma.attendance.count({ where: { kioskId: id } });
    if (attendances > 0) {
      throw conflictError(
        `Kiosk sudah memiliki ${attendances} riwayat absensi; nonaktifkan kiosk alih-alih menghapus`,
      );
    }
    await this.prisma.kiosk.delete({ where: { id } });
    this.kioskCache.invalidate(id);
    this.lastSeenWrittenAt.delete(id);
  }

  /** Secret baru → semua QR lama langsung tidak berlaku. */
  async rotateSecret(id: string, actorId: string, client: ClientInfo): Promise<KioskView> {
    await this.findOne(id);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.kiosk.update({
        where: { id },
        data: { secret: newSecret() },
        select: KIOSK_SELECT,
      });
      await this.audit.log(
        {
          actorId,
          action: AuditAction.KIOSK_SECRET_ROTATED,
          entity: 'Kiosk',
          entityId: id,
          metadata: { name: updated.name },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
      return updated;
    });
    this.kioskCache.invalidate(id);
    return row;
  }

  /** Token QR terkini untuk layar kiosk (dipolling ~5 detik). */
  async getCurrentQr(id: string, now: Date = this.clock.now()): Promise<KioskQr> {
    const kiosk = await this.kioskCache.get(id, now.getTime());
    if (!kiosk) throw notFoundError('Kiosk tidak ditemukan');
    if (!kiosk.isActive || !kiosk.location.isActive) {
      throw new BusinessException(ErrorCode.KIOSK_INACTIVE);
    }

    const { token, expiresAt } = this.qr.generateKioskToken(kiosk, now);
    await this.touchLastSeen(id, now);

    return {
      token,
      expiresAt,
      intervalSeconds: kiosk.qrIntervalSeconds,
      serverTime: now,
      kiosk: { id: kiosk.id, name: kiosk.name, locationName: kiosk.location.name },
    };
  }

  /**
   * 10 scan berhasil terakhir hari ini (APP_TIMEZONE) di kiosk ini. Tipe masuk/pulang
   * ditentukan dari stempel waktu absensi yang paling dekat dengan waktu scan.
   */
  async recentScans(id: string): Promise<RecentScan[]> {
    await this.findOne(id);
    const today = toTzDateString(this.clock.now());

    const logs = await this.prisma.attendanceScanLog.findMany({
      where: {
        kioskId: id,
        success: true,
        userId: { not: null },
        createdAt: { gte: combineDateAndTime(today, '00:00') },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_SCAN_LIMIT,
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, employeeCode: true, avatarUrl: true } },
      },
    });

    const userIds = [...new Set(logs.flatMap((log) => (log.user ? [log.user.id] : [])))];
    const attendances = userIds.length
      ? await this.prisma.attendance.findMany({
          where: { userId: { in: userIds }, date: toDbDate(today) },
          select: { userId: true, status: true, checkInAt: true, checkOutAt: true },
        })
      : [];
    const byUser = new Map(attendances.map((a) => [a.userId, a]));

    return logs.flatMap((log) => {
      if (!log.user) return [];
      const attendance = byUser.get(log.user.id);
      return [
        {
          id: log.id,
          name: log.user.name,
          employeeCode: log.user.employeeCode,
          avatarUrl: log.user.avatarUrl,
          type: scanType(log.createdAt, attendance),
          time: log.createdAt,
          status: attendance?.status ?? null,
        },
      ];
    });
  }

  private async assertActiveLocation(locationId: string): Promise<void> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { isActive: true },
    });
    if (!location?.isActive) {
      throw fieldError('locationId', 'Lokasi tidak ditemukan atau tidak aktif');
    }
  }

  private async touchLastSeen(id: string, now: Date): Promise<void> {
    const last = this.lastSeenWrittenAt.get(id) ?? 0;
    if (now.getTime() - last < LAST_SEEN_WRITE_INTERVAL_MS) return;
    this.lastSeenWrittenAt.set(id, now.getTime());
    try {
      await this.prisma.kiosk.update({ where: { id }, data: { lastSeenAt: now } });
    } catch (error) {
      // Gagal mencatat lastSeenAt tidak boleh menghentikan tampilan QR.
      this.logger.warn(`Gagal memperbarui lastSeenAt kiosk ${id}: ${String(error)}`);
    }
  }
}

function scanType(
  scannedAt: Date,
  attendance: { checkInAt: Date | null; checkOutAt: Date | null } | undefined,
): 'CHECK_IN' | 'CHECK_OUT' {
  if (!attendance?.checkOutAt) return 'CHECK_IN';
  if (!attendance.checkInAt) return 'CHECK_OUT';
  const toCheckIn = Math.abs(scannedAt.getTime() - attendance.checkInAt.getTime());
  const toCheckOut = Math.abs(scannedAt.getTime() - attendance.checkOutAt.getTime());
  return toCheckOut < toCheckIn ? 'CHECK_OUT' : 'CHECK_IN';
}
