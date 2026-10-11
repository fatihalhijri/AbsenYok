// Harus paling awal: validasi env sebelum modul lain dievaluasi.
import './config/env.preflight';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { SWAGGER_PATH } from './common/constants/app.constants';
import { AppConfigService } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get(AppConfigService);
  const port = config.get('PORT');
  await app.listen(port);

  logger.log(`${config.get('APP_NAME')} API berjalan di http://localhost:${port}`, 'Bootstrap');
  if (!config.isProduction) {
    logger.log(`Dokumentasi Swagger: http://localhost:${port}/${SWAGGER_PATH}`, 'Bootstrap');
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Gagal menjalankan aplikasi:', error);
  process.exit(1);
});
