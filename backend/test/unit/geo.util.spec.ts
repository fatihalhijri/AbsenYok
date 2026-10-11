import { haversineMeters } from '@/common/utils/geo.util';

describe('geo.util haversineMeters()', () => {
  it('jarak titik yang sama adalah 0', () => {
    expect(haversineMeters(-6.175392, 106.827153, -6.175392, 106.827153)).toBe(0);
  });

  it('1 derajat bujur di khatulistiwa ≈ 111,2 km', () => {
    expect(haversineMeters(0, 0, 0, 1)).toBeCloseTo(111_195.08, 1);
  });

  it('Monas → Bundaran HI ≈ 2,2 km', () => {
    const distance = haversineMeters(-6.175392, 106.827153, -6.19498, 106.823027);
    expect(distance).toBeGreaterThan(2_215);
    expect(distance).toBeLessThan(2_235);
  });

  it('simetris', () => {
    const a = haversineMeters(-6.2, 106.8, -6.21, 106.85);
    const b = haversineMeters(-6.21, 106.85, -6.2, 106.8);
    expect(a).toBeCloseTo(b, 6);
  });

  it('akurat untuk jarak geofence (± 50 m ke utara)', () => {
    const offsetLat = 50 / 111_195.08;
    expect(haversineMeters(-6.2, 106.8, -6.2 + offsetLat, 106.8)).toBeCloseTo(50, 1);
  });
});
