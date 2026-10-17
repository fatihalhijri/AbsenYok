// `npm start`: jalankan server standalone hasil `npm run build` — sama dengan image Docker.
// `next start` tidak mendukung `output: 'standalone'`; server mandiri butuh `public/` dan
// `.next/static/` disalin ke sebelahnya (di Docker dilakukan oleh Dockerfile).
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(root, '.next', 'standalone');
const server = join(standalone, 'server.js');

if (!existsSync(server)) {
  console.error('Belum ada build produksi. Jalankan `npm run build` terlebih dahulu.');
  process.exit(1);
}
cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true });
cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });

process.env.PORT ??= '3000';
await import(pathToFileURL(server).href);
