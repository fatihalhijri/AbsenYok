import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createSerwistRoute } from '@serwist/turbopack';

/**
 * Revisi untuk entri precache tambahan (/offline): berubah setiap commit sehingga salinan lama
 * diganti. Di luar repo git (mis. build Docker) memakai UUID acak per build.
 */
const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() || randomUUID();

const serwistRoute = createSerwistRoute({
  swSrc: 'src/app/sw.ts',
  additionalPrecacheEntries: [{ url: '/offline', revision }],
  useNativeEsbuild: true,
});

/**
 * Menyajikan service worker di `/serwist/sw.js` (header `Service-Worker-Allowed: /`).
 * Hanya `GET` & `generateStaticParams` yang diekspor: route segment config `dynamic`,
 * `dynamicParams`, dan `revalidate` tidak tersedia saat `cacheComponents` aktif. Tanpa itu,
 * route tetap di-prerender saat build untuk setiap file hasil `generateStaticParams`.
 */
export const { GET, generateStaticParams } = serwistRoute;
