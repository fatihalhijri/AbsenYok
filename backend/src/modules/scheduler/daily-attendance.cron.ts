import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ClockService } from '@/common/clock/clock.service';
import { toTzDateString } from '@/common/utils/date.util';
import { AppConfigService } from '@/config/app.config';
import { AttendanceRecalculateService } from '@/modules/attendance/attendance-recalculate.service';

export const DAILY_ATTENDANCE_JOB = 'daily-attendance';
/** Setiap hari pukul 23:55 waktu APP_TIMEZONE (BUSINESS-RULES §10). */
export const DAILY_ATTENDANCE_CRON = '0 55 23 * * *';

/**
 * Cron penandaan ABSENT/cuti harian. Didaftarkan dinamis agar zona waktu diambil dari
 * `APP_TIMEZONE` (setara `@Cron('55 23 * * *', { timeZone })`). Tidak aktif saat test.
 */
@Injectable()
export class DailyAttendanceCron implements OnModuleInit {
  private readonly logger = new Logger(DailyAttendanceCron.name);

  constructor(
    private readonly recalculate: AttendanceRecalculateService,
    private readonly config: AppConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    if (this.config.isTest) return;
    const job = CronJob.from({
      cronTime: DAILY_ATTENDANCE_CRON,
      timeZone: this.config.get('APP_TIMEZONE'),
      onTick: () => void this.run(),
      start: true,
    });
    this.scheduler.addCronJob(DAILY_ATTENDANCE_JOB, job);
  }

  async run(): Promise<void> {
    const date = toTzDateString(this.clock.now());
    try {
      const outcome = await this.recalculate.withLock(() => this.recalculate.run(date));
      if (!outcome.acquired) {
        this.logger.warn(`Penandaan harian ${date} dilewati: sedang dijalankan instance lain`);
        return;
      }
      const { processed, created, updated, skipped, durationMs } = outcome.result;
      this.logger.log(
        `Penandaan harian ${date}: ${JSON.stringify({ processed, created, updated, skipped, durationMs })}`,
      );
    } catch (error) {
      this.logger.error(
        `Penandaan harian ${date} gagal`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
