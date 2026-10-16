/** Pengolahan gambar di client (canvas): kompres sebelum upload & crop persegi avatar. */

export interface CompressOptions {
  /** Sisi terpanjang maksimum (px). */
  maxSide?: number;
  /** Kualitas JPEG/WebP 0–1. */
  quality?: number;
}

/** Ukuran hasil skala agar sisi terpanjang ≤ `maxSide` (tidak pernah diperbesar). */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak dapat dibaca'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Gagal memproses gambar'))),
      type,
      quality,
    ),
  );
}

const renamed = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`;

/**
 * Perkecil foto (maks sisi 1600 px, kualitas 0.8) → JPEG. PNG/JPG yang sudah kecil dan
 * hasilnya tidak lebih ringan dikembalikan apa adanya. File non-gambar tidak disentuh.
 */
export async function compressImage(
  file: File,
  { maxSide = 1600, quality = 0.8 }: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const image = await loadImage(file);
  const size = fitWithin(image.naturalWidth, image.naturalHeight, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  // Latar putih: PNG transparan → JPEG tidak menjadi hitam.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(image, 0, 0, size.width, size.height);
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  if (blob.size >= file.size && size.width === image.naturalWidth) return file;
  return new File([blob], renamed(file.name, 'jpg'), { type: 'image/jpeg' });
}

/** Area crop dalam piksel gambar asli. */
export interface CropArea {
  x: number;
  y: number;
  size: number;
}

/** Potong area persegi dari gambar → JPEG `outputSize`×`outputSize` (avatar). */
export async function cropSquare(
  file: Blob,
  area: CropArea,
  { outputSize = 512, quality = 0.85 } = {},
): Promise<File> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pengolahan gambar');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.drawImage(image, area.x, area.y, area.size, area.size, 0, 0, outputSize, outputSize);
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

export { loadImage };
