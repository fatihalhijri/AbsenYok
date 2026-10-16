// Salin mesin ZXing WASM (polyfill BarcodeDetector) ke public/zxing/ agar dimuat dari server
// sendiri, bukan CDN. Dijalankan otomatis oleh `predev` & `prebuild`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
const targetDir = join(root, 'public/zxing');

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, 'zxing_reader.wasm'));
console.log('✓ zxing_reader.wasm → public/zxing/');
