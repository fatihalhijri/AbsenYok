import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Prisma, PrismaClient } from '@/generated/prisma/client';
import { AppConfigService } from '@/config/app.config';
import { createPrismaAdapter } from './prisma-adapter';

export const SLOW_QUERY_THRESHOLD_MS = 500;

type PrismaServiceOptions = Prisma.PrismaClientOptions & { log: Prisma.LogDefinition[] };
type PrismaLogEvents = 'query' | 'warn' | 'error';

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaServiceOptions, PrismaLogEvents>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    const isDevelopment = config.get('NODE_ENV') === 'development';

    super({
      adapter: createPrismaAdapter(config.get('DATABASE_URL'), config.isProduction),
      log: [
        ...(isDevelopment ? [{ emit: 'event' as const, level: 'query' as const }] : []),
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    if (isDevelopment) {
      this.$on('query', (event) => {
        if (event.duration > SLOW_QUERY_THRESHOLD_MS) {
          this.logger.warn(`Query lambat (${event.duration} ms): ${event.query}`);
        }
      });
    }
    this.$on('warn', (event) => this.logger.warn(event.message));
    this.$on('error', (event) => this.logger.error(event.message));
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
