import { createHash } from 'node:crypto';

const NAMESPACE = 'absenyok-seed';

function digest(key: string): Buffer {
  return createHash('sha256').update(`${NAMESPACE}:${key}`).digest();
}

/**
 * UUID v4 deterministik dari sebuah kunci. Dipakai untuk record seed tanpa kolom unik alami
 * (lokasi, kiosk, absensi, pengajuan izin) agar seed bisa di-upsert berulang tanpa duplikat.
 */
export function seedUuid(key: string): string {
  const bytes = digest(key).subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versi 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // varian RFC 4122
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Bilangan acak deterministik [0, 1) dari sebuah kunci — hasil seed sama setiap dijalankan. */
export function seedRandom(key: string): number {
  return digest(key).readUInt32BE(0) / 2 ** 32;
}

/** Bilangan bulat deterministik dalam rentang [min, max] (inklusif). */
export function seedInt(key: string, min: number, max: number): number {
  return min + Math.floor(seedRandom(key) * (max - min + 1));
}

/** "Siti Nurhaliza, S.Kom." → "siti.nurhaliza" (hanya huruf/angka, dipisah titik). */
export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(',')[0]
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
