import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfigService } from '@/config/app.config';
import { PrismaService } from '@/prisma/prisma.service';
import { REFRESH_TOKEN_RETENTION_DAYS } from './auth.constants';

export const REFRESH_TOKEN_CLEANUP_JOB = 'refresh-token-cleanup';
/** Setiap hari pukul 03:00 waktu APP_TIMEZONE. */
export const REFRESH_TOKEN_CLEANUP_CRON = '0 0 3 * * *';

const DAY_MS = 86_400_000;

/**
 * Menghapus refresh token yang kedaluwarsa > 7 hari. Token yang dicabut tetapi belum
 * kedaluwarsa dipertahankan agar deteksi reuse tetap berfungsi.
 */
@Injectable()
export class RefreshTokenCleanupTask implements OnModuleInit {
  private readonly logger = new Logger(RefreshTokenCleanupTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (this.config.isTest) return;

    const job = CronJob.from({
      cronTime: REFRESH_TOKEN_CLEANUP_CRON,
      timeZone: this.config.get('APP_TIMEZONE'),
      onTick: () => void this.run(),
      start: true,
    });
    this.scheduler.addCronJob(REFRESH_TOKEN_CLEANUP_JOB, job);
  }

  async run(now: Date = new Date()): Promise<number> {
    try {
      const cutoff = new Date(now.getTime() - REFRESH_TOKEN_RETENTION_DAYS * DAY_MS);
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: cutoff } },
      });
      this.logger.log(`Pembersihan refresh token: ${count} token dihapus`);
      return count;
    } catch (error) {
      this.logger.error(
        'Pembersihan refresh token gagal',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    }
  }
}
