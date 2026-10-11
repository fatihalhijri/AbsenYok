import { seedInt, seedRandom, seedUuid, slugifyName } from '../../prisma/seed-utils';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('seed-utils', () => {
  it('seedUuid() deterministik dan berformat UUID v4', () => {
    const id = seedUuid('kiosk:lobi-utama');
    expect(id).toMatch(UUID_V4);
    expect(seedUuid('kiosk:lobi-utama')).toBe(id);
    expect(seedUuid('kiosk:lobi-lain')).not.toBe(id);
  });

  it('seedRandom() deterministik dalam rentang [0, 1)', () => {
    const values = Array.from({ length: 500 }, (_, i) => seedRandom(`key:${i}`));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(seedRandom('key:1')).toBe(values[1]);
    // Sebaran kasar seragam: rata-rata mendekati 0,5.
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('seedInt() inklusif di kedua batas', () => {
    const values = new Set(Array.from({ length: 300 }, (_, i) => seedInt(`late:${i}`, 16, 18)));
    expect([...values].sort()).toEqual([16, 17, 18]);
  });

  it.each([
    ['Siti Nurhaliza', 'siti.nurhaliza'],
    ["Ni Luh Putu Ayu'", 'ni.luh.putu.ayu'],
    ['Dr. Budi Santoso, S.Kom.', 'dr.budi.santoso'],
    ['Zaïnab Rahmã', 'zainab.rahma'],
  ])('slugifyName(%s) → %s', (name, expected) => {
    expect(slugifyName(name)).toBe(expected);
  });
});
