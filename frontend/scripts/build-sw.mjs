// Bangun service worker sekali SETELAH `next build` → public/sw.js (+ source map).
//
// Mengapa bukan route `/serwist/[path]` bawaan @serwist/turbopack? Dengan `cacheComponents`,
// route itu tidak bisa diberi `dynamic = 'force-static'` sehingga tidak di-prerender dan
// mem-bundle `src/app/sw.ts` dengan esbuild SAAT REQUEST — gagal (500) di server standalone/Docker
// yang tidak membawa source. Skrip ini memakai `createSerwistRoute` yang sama (daftar precache &
// bundling identik), hanya dijalankan saat build. Service worker dinonaktifkan di `next dev`.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSerwistRoute } from '@serwist/turbopack';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const publicDir = join(root, 'public');

// Hasil build lama tidak boleh ikut masuk daftar precache (glob `public/**/*`).
for (const file of ['sw.js', 'sw.js.map']) rmSync(join(publicDir, file), { force: true });

/**
 * Revisi entri precache tambahan (/offline): berubah tiap commit sehingga salinan lama diganti.
 * Di luar repo git (mis. build Docker tanpa .git) memakai UUID acak per build.
 */
const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() || randomUUID();

const route = createSerwistRoute({
  swSrc: 'src/app/sw.ts',
  additionalPrecacheEntries: [{ url: '/offline', revision }],
  useNativeEsbuild: true,
});

const files = await route.generateStaticParams();
for (const { path } of files) {
  const response = await route.GET(new Request(`http://localhost/${path}`), {
    params: Promise.resolve({ path }),
  });
  if (!response.ok) throw new Error(`Gagal membangun ${path}: HTTP ${response.status}`);
  const target = join(publicDir, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, await response.text());
  console.log(`✓ service worker → public/${path}`);
}
