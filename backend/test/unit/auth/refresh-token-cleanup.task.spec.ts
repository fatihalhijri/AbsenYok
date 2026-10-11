import type { SchedulerRegistry } from '@nestjs/schedule';
import {
  REFRESH_TOKEN_CLEANUP_CRON,
  RefreshTokenCleanupTask,
} from '@/modules/auth/refresh-token-cleanup.task';
import type { PrismaService } from '@/prisma/prisma.service';
import { createConfigStub } from './auth-test-helpers';

describe('RefreshTokenCleanupTask', () => {
  const deleteMany = jest.fn();
  const scheduler = { addCronJob: jest.fn() };
  const task = new RefreshTokenCleanupTask(
    { refreshToken: { deleteMany } } as unknown as PrismaService,
    createConfigStub(),
    scheduler as unknown as SchedulerRegistry,
  );

  it('menghapus token yang kedaluwarsa lebih dari 7 hari', async () => {
    deleteMany.mockResolvedValue({ count: 4 });
    const now = new Date('2026-10-11T20:00:00.000Z');

    await expect(task.run(now)).resolves.toBe(4);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: new Date('2026-10-04T20:00:00.000Z') } },
    });
  });

  it('kegagalan database tidak melempar error (cron tetap hidup)', async () => {
    deleteMany.mockRejectedValue(new Error('DB down'));
    await expect(task.run()).resolves.toBe(0);
  });

  it('tidak mendaftarkan cron saat NODE_ENV=test; jadwal 03:00 setiap hari', () => {
    task.onModuleInit();
    expect(scheduler.addCronJob).not.toHaveBeenCalled();
    expect(REFRESH_TOKEN_CLEANUP_CRON).toBe('0 0 3 * * *');
  });
});
