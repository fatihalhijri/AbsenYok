import type { ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AVATAR_DIR_NAME, AVATAR_PUBLIC_PATH } from '@/modules/users/users.constants';
import type { AppConfigService } from './app.config';

const AVATAR_CACHE_SECONDS = 7 * 24 * 60 * 60;

/**
 * File statis publik: HANYA folder avatar. Lampiran izin (BE-08) berisi data sensitif dan
 * harus lewat endpoint ber-otorisasi, jadi `UPLOAD_DIR` tidak disajikan seluruhnya.
 * Nama file avatar berupa UUID baru setiap unggah → aman di-cache lama (immutable).
 *
 * Memakai `useStaticAssets` (express.static) — bukan ServeStaticModule — karena modul tersebut
 * memilih loader saat compile sehingga tidak aktif di testing module (e2e) dan punya fallback
 * index.html (perilaku SPA) yang tidak diinginkan untuk folder upload.
 */
export function registerStaticFiles(app: NestExpressApplication, config: AppConfigService): void {
  app.useStaticAssets(join(resolve(config.get('UPLOAD_DIR')), AVATAR_DIR_NAME), {
    prefix: AVATAR_PUBLIC_PATH,
    index: false,
    dotfiles: 'deny',
    redirect: false,
    // File tidak ada → diteruskan ke router Nest → 404 JSON standar.
    fallthrough: true,
    setHeaders: (res: ServerResponse) => {
      res.setHeader('Cache-Control', `public, max-age=${AVATAR_CACHE_SECONDS}, immutable`);
      // Avatar boleh ditampilkan dari origin frontend (helmet default: same-origin).
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
}
