import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_PREFIX, SWAGGER_PATH } from '@/common/constants/app.constants';
import { AppConfigService } from '@/config/app.config';
import { registerStaticFiles } from '@/config/static-files.config';
import { HEALTH_PREFIX_EXCLUDES } from '@/modules/health/health.constants';

/**
 * Konfigurasi HTTP aplikasi. Dipakai main.ts dan test e2e agar perilakunya identik.
 * Filter, interceptor, dan ValidationPipe global didaftarkan di AppModule (APP_*).
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfigService);

  // Percayai hanya proxy di jaringan lokal/privat (Next.js, Docker) agar IP klien akurat
  // dan header X-Forwarded-For dari internet tidak bisa memalsukan IP.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  app.setGlobalPrefix(API_PREFIX, { exclude: HEALTH_PREFIX_EXCLUDES });

  app.use(
    helmet({
      // Di luar produksi, Swagger UI bisa dibuka lewat HTTP (mis. IP LAN) tanpa aset di-upgrade ke HTTPS.
      contentSecurityPolicy: config.isProduction
        ? undefined
        : { directives: { upgradeInsecureRequests: null } },
    }),
  );
  app.use(cookieParser());
  registerStaticFiles(app, config);
  app.enableCors({
    origin: config.get('CORS_ORIGIN'),
    credentials: true,
  });

  if (!config.isProduction) {
    setupSwagger(app, config);
  }
}

function setupSwagger(app: NestExpressApplication, config: AppConfigService): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(`${config.get('APP_NAME')} API`)
      .setDescription('REST API aplikasi absensi QR Code AbsenYok')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
