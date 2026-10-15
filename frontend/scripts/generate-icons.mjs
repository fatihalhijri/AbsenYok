// Membuat ikon PWA placeholder "AY" (PNG) dari SVG. Jalankan: npm run gen:icons
// Hasil di-commit; jalankan ulang hanya bila desain ikon berubah.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIMARY = '#059669'; // emerald-600 — warna primer (lihat prompts/02)
const FOREGROUND = '#ffffff';
const FONT = 'Arial, Helvetica, sans-serif';

/**
 * @param {object} options
 * @param {boolean} options.maskable  latar penuh (tanpa sudut bulat), huruf di zona aman 80%
 * @param {number} [options.radius]   radius sudut relatif ukuran (ikon "any")
 */
function iconSvg({ maskable, radius = 0.22 }) {
  const size = 512;
  const fontSize = maskable ? 200 : 260;
  const rx = maskable ? 0 : size * radius;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${PRIMARY}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="${FONT}" font-weight="700"
    font-size="${fontSize}" letter-spacing="-8" fill="${FOREGROUND}">AY</text>
</svg>`;
}

const outputs = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  { file: 'public/icons/icon-maskable-192.png', size: 192, maskable: true },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
  // iOS membulatkan sudut sendiri → latar penuh.
  { file: 'public/icons/apple-touch-icon.png', size: 180, maskable: true },
];

for (const { file, size, maskable } of outputs) {
  const target = join(ROOT, file);
  await mkdir(dirname(target), { recursive: true });
  await sharp(Buffer.from(iconSvg({ maskable })))
    .resize(size, size)
    .png()
    .toFile(target);
  console.log(`✓ ${file}`);
}

/**
 * favicon.ico (container ICO berisi PNG 16/32/48) — browser tetap meminta /favicon.ico walau
 * sudah ada icon.svg. Format ICO+PNG didukung semua browser modern.
 */
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(
  icoSizes.map((size) =>
    sharp(Buffer.from(iconSvg({ maskable: false })))
      .resize(size, size)
      .png()
      .toBuffer(),
  ),
);
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // tipe: ikon
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, index) => {
  const entry = 6 + 16 * index;
  header.writeUInt8(icoSizes[index], entry); // lebar
  header.writeUInt8(icoSizes[index], entry + 1); // tinggi
  header.writeUInt16LE(1, entry + 4); // color planes
  header.writeUInt16LE(32, entry + 6); // bit per piksel
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(join(ROOT, 'src/app/favicon.ico'), Buffer.concat([header, ...pngs]));
console.log('✓ src/app/favicon.ico');

// Favicon vektor (konvensi file Next.js: src/app/icon.svg).
await writeFile(join(ROOT, 'src/app/icon.svg'), iconSvg({ maskable: false }) + '\n');
console.log('✓ src/app/icon.svg');
