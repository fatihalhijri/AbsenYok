import type { CropArea } from '@/lib/image';

/** Posisi gambar di viewport crop persegi (px layar). */
export interface CropView {
  /** Pergeseran kiri-atas gambar relatif viewport (≤ 0). */
  x: number;
  y: number;
  /** Faktor zoom ≥ 1 (1 = gambar menutup viewport). */
  zoom: number;
}

/** Skala px-layar per px-gambar: sisi terpendek gambar = viewport saat zoom 1. */
export const scaleFor = (
  natural: { width: number; height: number },
  viewport: number,
  zoom: number,
) => (viewport / Math.min(natural.width, natural.height)) * zoom;

/** Batasi pergeseran agar viewport selalu tertutup gambar (tanpa area kosong). */
export function clampView(
  view: CropView,
  natural: { width: number; height: number },
  viewport: number,
): CropView {
  const scale = scaleFor(natural, viewport, view.zoom);
  const minX = viewport - natural.width * scale;
  const minY = viewport - natural.height * scale;
  return {
    zoom: view.zoom,
    x: Math.min(0, Math.max(minX, view.x)),
    y: Math.min(0, Math.max(minY, view.y)),
  };
}

/** Tampilan awal: zoom 1, gambar di tengah. */
export function centeredView(
  natural: { width: number; height: number },
  viewport: number,
): CropView {
  const scale = scaleFor(natural, viewport, 1);
  return {
    zoom: 1,
    x: (viewport - natural.width * scale) / 2,
    y: (viewport - natural.height * scale) / 2,
  };
}

/** Ubah zoom dengan titik tengah viewport tetap di posisi yang sama pada gambar. */
export function zoomAroundCenter(
  view: CropView,
  zoom: number,
  natural: { width: number; height: number },
  viewport: number,
): CropView {
  const before = scaleFor(natural, viewport, view.zoom);
  const after = scaleFor(natural, viewport, zoom);
  const centerX = (viewport / 2 - view.x) / before;
  const centerY = (viewport / 2 - view.y) / before;
  return clampView(
    { zoom, x: viewport / 2 - centerX * after, y: viewport / 2 - centerY * after },
    natural,
    viewport,
  );
}

/** Area crop dalam piksel gambar asli untuk `cropSquare`. */
export function cropAreaOf(
  view: CropView,
  natural: { width: number; height: number },
  viewport: number,
): CropArea {
  const scale = scaleFor(natural, viewport, view.zoom);
  // Piksel utuh, tetap di dalam batas gambar.
  const size = Math.min(Math.round(viewport / scale), natural.width, natural.height);
  return {
    x: Math.min(natural.width - size, Math.max(0, Math.round(-view.x / scale))),
    y: Math.min(natural.height - size, Math.max(0, Math.round(-view.y / scale))),
    size,
  };
}
