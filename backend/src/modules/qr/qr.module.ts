import { Global, Module } from '@nestjs/common';
import { KioskCacheService } from './kiosk-cache.service';
import { QrService } from './qr.service';

/** Global: dipakai kiosks, users (QR personal), dan attendance (verifikasi scan). */
@Global()
@Module({
  providers: [QrService, KioskCacheService],
  exports: [QrService, KioskCacheService],
})
export class QrModule {}
