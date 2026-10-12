import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface ScanLogEntry {
  userId?: string | null;
  kioskId?: string | null;
  scanType: 'KIOSK' | 'PERSONAL';
  errorCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  /** Jarak ke titik lokasi (meter). */
  distance?: number | null;
  deviceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Waktu scan (dari ClockService) — dipakai juga oleh recent-scans kiosk. */
  createdAt: Date;
}

const toDecimal = (value: number | null | undefined) =>
  value === null || value === undefined ? null : value.toFixed(7);

/**
 * Jejak SETIAP percobaan scan (audit kecurangan & debugging).
 * - Berhasil: dicatat di transaksi yang sama dengan absensi.
 * - Gagal: dicatat terpisah; kegagalan menulis log tidak boleh menutupi error asli.
 */
@Injectable()
export class ScanLogService {
  private readonly logger = new Logger(ScanLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordSuccess(entry: ScanLogEntry, tx: Prisma.TransactionClient): Promise<void> {
    await tx.attendanceScanLog.create({ data: this.toData(entry, true) });
  }

  async recordFailure(entry: ScanLogEntry): Promise<void> {
    try {
      await this.prisma.attendanceScanLog.create({ data: this.toData(entry, false) });
    } catch (error) {
      this.logger.error(
        `Gagal mencatat log scan (${entry.errorCode ?? '-'})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private toData(
    entry: ScanLogEntry,
    success: boolean,
  ): Prisma.AttendanceScanLogUncheckedCreateInput {
    return {
      userId: entry.userId ?? null,
      kioskId: entry.kioskId ?? null,
      scanType: entry.scanType,
      success,
      errorCode: success ? null : (entry.errorCode ?? null),
      latitude: toDecimal(entry.latitude),
      longitude: toDecimal(entry.longitude),
      accuracy: entry.accuracy ?? null,
      distance: entry.distance ?? null,
      deviceId: entry.deviceId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      createdAt: entry.createdAt,
    };
  }
}
