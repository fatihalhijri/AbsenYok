import { setAppTimezone } from '@/common/utils/date.util';
import { countWorkingDays, listWorkingDays } from '@/modules/leave-requests/leave-days';

const MON_FRI = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const NO_HOLIDAY = new Set<string>();

describe('leave-days: totalDays pengajuan', () => {
  beforeAll(() => setAppTimezone('Asia/Jakarta'));

  it('satu minggu penuh Sen–Min → 5 hari kerja (akhir pekan dilewati)', () => {
    expect(countWorkingDays({ from: '2026-10-19', to: '2026-10-25' }, MON_FRI, NO_HOLIDAY)).toBe(5);
  });

  it('Jumat s/d Senin → 2 hari (Sabtu & Minggu dilewati)', () => {
    expect(listWorkingDays({ from: '2026-10-23', to: '2026-10-26' }, MON_FRI, NO_HOLIDAY)).toEqual([
      '2026-10-23',
      '2026-10-26',
    ]);
  });

  it('hari libur di tengah rentang dilewati', () => {
    const holidays = new Set(['2026-10-21']);
    expect(listWorkingDays({ from: '2026-10-19', to: '2026-10-23' }, MON_FRI, holidays)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-22',
      '2026-10-23',
    ]);
  });

  it('libur yang jatuh di akhir pekan tidak dikurangi dua kali', () => {
    const holidays = new Set(['2026-10-24']);
    expect(countWorkingDays({ from: '2026-10-19', to: '2026-10-25' }, MON_FRI, holidays)).toBe(5);
  });

  it('shift Sen–Sab menghitung Sabtu sebagai hari kerja', () => {
    expect(countWorkingDays({ from: '2026-10-19', to: '2026-10-25' }, MON_SAT, NO_HOLIDAY)).toBe(6);
  });

  it('hanya akhir pekan → 0 hari kerja', () => {
    expect(countWorkingDays({ from: '2026-10-24', to: '2026-10-25' }, MON_FRI, NO_HOLIDAY)).toBe(0);
  });

  it('rentang 1 hari & melewati pergantian bulan', () => {
    expect(countWorkingDays({ from: '2026-10-22', to: '2026-10-22' }, MON_FRI, NO_HOLIDAY)).toBe(1);
    expect(listWorkingDays({ from: '2026-10-30', to: '2026-11-02' }, MON_FRI, NO_HOLIDAY)).toEqual([
      '2026-10-30',
      '2026-11-02',
    ]);
  });
});
