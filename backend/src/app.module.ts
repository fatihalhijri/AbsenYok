import { CacheModule } from '@nestjs/cache-manager';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ClockModule } from '@/common/clock/clock.module';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TransformResponseInterceptor } from '@/common/interceptors/transform-response.interceptor';
import { validationExceptionFactory } from '@/common/pipes/validation-exception.factory';
import { setAppTimezone } from '@/common/utils/date.util';
import { AppConfigModule, AppConfigService } from '@/config/app.config';
import { buildLoggerParams } from '@/config/logger.config';
import { AttendanceModule } from '@/modules/attendance/attendance.module';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { DepartmentsModule } from '@/modules/departments/departments.module';
import { HealthModule } from '@/modules/health/health.module';
import { HolidaysModule } from '@/modules/holidays/holidays.module';
import { KiosksModule } from '@/modules/kiosks/kiosks.module';
import { LeaveRequestsModule } from '@/modules/leave-requests/leave-requests.module';
import { LocationsModule } from '@/modules/locations/locations.module';
import { QrModule } from '@/modules/qr/qr.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { SchedulerModule } from '@/modules/scheduler/scheduler.module';
import { SettingsModule } from '@/modules/settings/settings.module';
import { ShiftsModule } from '@/modules/shifts/shifts.module';
import { UsersModule } from '@/modules/users/users.module';
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
    ClockModule,
    PrismaModule,
    AuditLogsModule,
    AuthModule,
    QrModule,
    SettingsModule,
    UsersModule,
    DepartmentsModule,
    ShiftsModule,
    LocationsModule,
    HolidaysModule,
    KiosksModule,
    AttendanceModule,
    LeaveRequestsModule,
    DashboardModule,
    ReportsModule,
    SchedulerModule,
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
