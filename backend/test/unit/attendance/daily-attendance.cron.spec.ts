import type { SchedulerRegistry } from '@nestjs/schedule';
import type { CronJob } from 'cron';
import type { AppConfigService } from '@/config/app.config';
import type { AttendanceRecalculateService } from '@/modules/attendance/attendance-recalculate.service';
import {
  DAILY_ATTENDANCE_CRON,
  DAILY_ATTENDANCE_JOB,
  DailyAttendanceCron,
} from '@/modules/scheduler/daily-attendance.cron';

function createCron(isTest: boolean) {
  const recalculate = {
    run: jest.fn().mockResolvedValue({
      date: '2026-10-19',
      processed: 3,
      created: 1,
      updated: 0,
      skipped: null,
      durationMs: 12,
    }),
    withLock: jest.fn(async (fn: () => Promise<unknown>) => ({
      acquired: true,
      result: await fn(),
    })),
  };
  const scheduler = { addCronJob: jest.fn() };
  const config = { isTest, get: () => 'Asia/Jakarta' } as unknown as AppConfigService;
  const clock = { now: () => new Date('2026-10-19T16:55:00.000Z') };
  const cron = new DailyAttendanceCron(
    recalculate as unknown as AttendanceRecalculateService,
    config,
    scheduler as unknown as SchedulerRegistry,
    clock,
  );
  return { cron, recalculate, scheduler };
}

describe('DailyAttendanceCron', () => {
  it('terdaftar pukul 23:55 zona APP_TIMEZONE', () => {
    const { cron, scheduler } = createCron(false);
    cron.onModuleInit();

    expect(scheduler.addCronJob).toHaveBeenCalledWith(DAILY_ATTENDANCE_JOB, expect.anything());
    const job = scheduler.addCronJob.mock.calls[0][1] as CronJob;
    expect(DAILY_ATTENDANCE_CRON).toBe('0 55 23 * * *');
    // Eksekusi berikutnya jatuh pada 23:55 WIB (16:55 UTC).
    expect(job.nextDate().setZone('Asia/Jakarta').toFormat('HH:mm')).toBe('23:55');
    void job.stop();
  });

  it('tidak didaftarkan saat NODE_ENV=test', () => {
    const { cron, scheduler } = createCron(true);
    cron.onModuleInit();
    expect(scheduler.addCronJob).not.toHaveBeenCalled();
  });

  it('memproses tanggal lokal hari ini di bawah lock', async () => {
    const { cron, recalculate } = createCron(true);
    await cron.run();
    expect(recalculate.withLock).toHaveBeenCalledTimes(1);
    expect(recalculate.run).toHaveBeenCalledWith('2026-10-19');
  });

  it('lock dipegang instance lain → dilewati tanpa error', async () => {
    const { cron, recalculate } = createCron(true);
    recalculate.withLock.mockResolvedValueOnce({ acquired: false } as never);
    await expect(cron.run()).resolves.toBeUndefined();
    expect(recalculate.run).not.toHaveBeenCalled();
  });

  it('error saat proses tidak menghentikan aplikasi', async () => {
    const { cron, recalculate } = createCron(true);
    recalculate.withLock.mockRejectedValueOnce(new Error('DB down'));
    await expect(cron.run()).resolves.toBeUndefined();
  });
});
