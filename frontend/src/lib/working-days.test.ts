import { describe, expect, it } from 'vitest';
import { countWorkingDays, datesBetween, parseWorkDays } from './working-days';

const MON_FRI = [1, 2, 3, 4, 5];

describe('parseWorkDays', () => {
  it('mengurai string backend & mengabaikan nilai rusak', () => {
    expect(parseWorkDays('1,2,3,4,5')).toEqual(MON_FRI);
    expect(parseWorkDays(' 1, 6 ,x,9')).toEqual([1, 6]);
    expect(parseWorkDays(null)).toEqual([]);
  });
});

describe('countWorkingDays', () => {
  it('Senin–Minggu = 5 hari kerja (Sabtu/Minggu bukan hari kerja)', () => {
    // 12 Okt 2026 = Senin
    expect(countWorkingDays('2026-10-12', '2026-10-18', MON_FRI, new Set())).toBe(5);
  });

  it('hari libur di hari kerja tidak dihitung', () => {
    expect(countWorkingDays('2026-10-12', '2026-10-16', MON_FRI, new Set(['2026-10-14']))).toBe(4);
  });

  it('satu hari & akhir pekan saja', () => {
    expect(countWorkingDays('2026-10-12', '2026-10-12', MON_FRI, new Set())).toBe(1);
    expect(countWorkingDays('2026-10-17', '2026-10-18', MON_FRI, new Set())).toBe(0);
  });

  it('shift 6 hari & lintas bulan/tahun', () => {
    expect(countWorkingDays('2026-12-28', '2027-01-03', [1, 2, 3, 4, 5, 6], new Set())).toBe(6);
    expect(datesBetween('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('rentang terbalik → 0', () => {
    expect(countWorkingDays('2026-10-16', '2026-10-12', MON_FRI, new Set())).toBe(0);
  });
});
