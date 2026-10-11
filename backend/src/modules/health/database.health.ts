import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '@/prisma/prisma.service';

export const DATABASE_HEALTH_KEY = 'db';
export const DATABASE_HEALTH_TIMEOUT_MS = 3_000;

/** Cek koneksi MySQL dengan `SELECT 1` dan batas waktu agar health check tidak menggantung. */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async pingCheck(
    timeoutMs: number = DATABASE_HEALTH_TIMEOUT_MS,
  ): Promise<HealthIndicatorResult<typeof DATABASE_HEALTH_KEY>> {
    const indicator = this.healthIndicator.check(DATABASE_HEALTH_KEY);
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Tidak ada respons dalam ${timeoutMs} ms`)),
            timeoutMs,
          );
        }),
      ]);
      return indicator.up();
    } catch (error) {
      // Pesan driver bisa memuat host/user; cukup laporkan bahwa database tidak terjangkau.
      return indicator.down({
        message:
          error instanceof Error && error.message.startsWith('Tidak ada respons')
            ? error.message
            : 'Database tidak dapat dihubungi',
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
