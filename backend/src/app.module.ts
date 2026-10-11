import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '@/common/interceptors/transform-response.interceptor';
import { validationExceptionFactory } from '@/common/pipes/validation-exception.factory';
import { setAppTimezone } from '@/common/utils/date.util';
import { AppConfigModule, AppConfigService } from '@/config/app.config';
import { buildLoggerParams } from '@/config/logger.config';
import { HealthModule } from '@/modules/health/health.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: buildLoggerParams,
    }),
    PrismaModule,
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
  ],
})
export class AppModule {
  constructor(config: AppConfigService) {
    setAppTimezone(config.get('APP_TIMEZONE'));
  }
}
