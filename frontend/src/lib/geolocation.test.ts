import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickBetter } from '@/features/attendance/scan/use-precise-location';
import { GeoError, getCurrentPosition, toGeoError } from './geolocation';

describe('toGeoError', () => {
  it.each([
    [1, 'PERMISSION_DENIED', /Izin lokasi ditolak/],
    [2, 'POSITION_UNAVAILABLE', /Lokasi tidak dapat ditentukan/],
    [3, 'TIMEOUT', /terlalu lama/],
  ])('kode %i → %s berpesan Indonesia', (code, expected, message) => {
    const error = toGeoError({ code });
    expect(error).toBeInstanceOf(GeoError);
    expect(error.code).toBe(expected);
    expect(error.message).toMatch(message);
  });
});

describe('getCurrentPosition', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('membungkus Geolocation API dengan opsi akurasi tinggi', async () => {
    const getCurrent = vi.fn((success: PositionCallback, _error, options?: PositionOptions) => {
      expect(options).toEqual({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
      success({
        coords: { latitude: -6.2, longitude: 106.8, accuracy: 9 },
        timestamp: 123,
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: getCurrent } });
    await expect(getCurrentPosition()).resolves.toEqual({
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 9,
      timestamp: 123,
    });
  });

  it('error browser → GeoError', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_s: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 1 } as GeolocationPositionError),
      },
    });
    await expect(getCurrentPosition()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('tanpa dukungan → UNSUPPORTED', async () => {
    vi.stubGlobal('navigator', {});
    await expect(getCurrentPosition()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });
});

describe('pickBetter (posisi terbaik usePreciseLocation)', () => {
  const at = (accuracy: number, timestamp: number) => ({
    latitude: 0,
    longitude: 0,
    accuracy,
    timestamp,
  });

  it('memilih akurasi terkecil', () => {
    expect(pickBetter(at(30, 0), at(12, 1000)).accuracy).toBe(12);
    expect(pickBetter(at(12, 0), at(30, 1000)).accuracy).toBe(12);
  });

  it('posisi baik yang sudah basi (> 15 dtk) digantikan posisi baru', () => {
    expect(pickBetter(at(12, 0), at(30, 16_000)).accuracy).toBe(30);
  });
});
