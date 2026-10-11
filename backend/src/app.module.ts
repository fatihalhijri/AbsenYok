import { CacheModule } from '@nestjs/cache-manager';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TransformResponseInterceptor } from '@/common/interceptors/transform-response.interceptor';
import { validationExceptionFactory } from '@/common/pipes/validation-exception.factory';
import { setAppTimezone } from '@/common/utils/date.util';
import { AppConfigModule, AppConfigService } from '@/config/app.config';
import { buildLoggerParams } from '@/config/logger.config';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { HealthModule } from '@/modules/health/health.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: buildLoggerParams,
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL_MS'),
            limit: config.get('THROTTLE_LIMIT'),
          },
        ],
      }),
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditLogsModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    },
    // Urutan guard global = urutan pendaftaran: Throttler → JwtAuth → Roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {
  constructor(config: AppConfigService) {
    setAppTimezone(config.get('APP_TIMEZONE'));
  }
}
