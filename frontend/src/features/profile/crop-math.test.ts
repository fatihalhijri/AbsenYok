import { describe, expect, it } from 'vitest';
import { centeredView, clampView, cropAreaOf, zoomAroundCenter } from './crop-math';

const LANDSCAPE = { width: 1600, height: 1200 };
const V = 280;

describe('crop avatar', () => {
  it('awal: gambar menutup viewport & berada di tengah → crop persegi tengah', () => {
    const view = centeredView(LANDSCAPE, V);
    expect(cropAreaOf(view, LANDSCAPE, V)).toEqual({ x: 200, y: 0, size: 1200 });
  });

  it('geser dibatasi agar tidak ada area kosong', () => {
    const clamped = clampView({ x: 50, y: -999, zoom: 1 }, LANDSCAPE, V);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0); // tinggi gambar = viewport → tidak bisa digeser vertikal
    expect(cropAreaOf(clamped, LANDSCAPE, V)).toEqual({ x: 0, y: 0, size: 1200 });
  });

  it('zoom 2× mempertahankan titik tengah', () => {
    const zoomed = zoomAroundCenter(centeredView(LANDSCAPE, V), 2, LANDSCAPE, V);
    const area = cropAreaOf(zoomed, LANDSCAPE, V);
    expect(area.size).toBeCloseTo(600);
    expect(area.x + area.size / 2).toBeCloseTo(800);
    expect(area.y + area.size / 2).toBeCloseTo(600);
  });
});
