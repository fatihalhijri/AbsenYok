import { HealthIndicatorService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '@/modules/health/database.health';
import type { PrismaService } from '@/prisma/prisma.service';

describe('DatabaseHealthIndicator', () => {
  const queryRaw = jest.fn();
  const indicator = new DatabaseHealthIndicator(
    { $queryRaw: queryRaw } as unknown as PrismaService,
    new HealthIndicatorService(),
  );

  afterEach(() => queryRaw.mockReset());

  it('up bila SELECT 1 berhasil', async () => {
    queryRaw.mockResolvedValue([{ 1: 1 }]);
    await expect(indicator.pingCheck()).resolves.toEqual({ db: { status: 'up' } });
  });

  it('down tanpa membocorkan detail koneksi', async () => {
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3306 (user absenyok)'));
    const result = await indicator.pingCheck();

    expect(result).toEqual({ db: { status: 'down', message: 'Database tidak dapat dihubungi' } });
    expect(JSON.stringify(result)).not.toContain('absenyok');
  });

  it('down bila database tidak merespons dalam batas waktu', async () => {
    queryRaw.mockReturnValue(new Promise(() => undefined));
    await expect(indicator.pingCheck(20)).resolves.toEqual({
      db: { status: 'down', message: 'Tidak ada respons dalam 20 ms' },
    });
  });
});
