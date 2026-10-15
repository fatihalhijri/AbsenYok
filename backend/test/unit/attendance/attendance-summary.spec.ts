import {
  daysInclusive,
  eachDate,
  monthRange,
  resolveDateRange,
} from '@/common/utils/date-range.util';
import { setAppTimezone } from '@/common/utils/date.util';
import { computeMonthlySummary, trackingStart } from '@/modules/attendance/attendance-summary';
import { BusinessException } from '@/common/exceptions/business.exception';

const record = (date: string, status: string, lateMinutes = 0, workMinutes = 480) => ({
  date,
  status,
  lateMinutes,
  workMinutes,
});

describe('date-range.util', () => {
  beforeAll(() => setAppTimezone('Asia/Jakarta'));

  it('monthRange menangani panjang bulan & tahun kabisat', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('daysInclusive & eachDate', () => {
    expect(daysInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(eachDate({ from: '2026-12-30', to: '2027-01-02' })).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('default: awal bulan s/d hari ini', () => {
    expect(resolveDateRange(undefined, undefined, '2026-10-19')).toEqual({
      from: '2026-10-01',
      to: '2026-10-19',
    });
  });

  it('92 hari diterima, 93 hari ditolak; dateFrom > dateTo ditolak', () => {
    expect(resolveDateRange('2026-07-20', '2026-10-19', '2026-10-19')).toEqual({
      from: '2026-07-20',
      to: '2026-10-19',
    });
    expect(() => resolveDateRange('2026-07-19', '2026-10-19', '2026-10-19')).toThrow(
      BusinessException,
    );
    expect(() => resolveDateRange('2026-10-20', '2026-10-19', '2026-10-19')).toThrow(
      BusinessException,
    );
  });
});

describe('computeMonthlySummary()', () => {
  // Oktober 2026: 1 Okt = Kamis. Senin–Jumat.
  const base = {
    workDays: [1, 2, 3, 4, 5],
    holidays: new Set<string>(),
    range: { from: '2026-10-01', to: '2026-10-31' },
  };

  it('menghitung status, total menit, dan attendanceRate (1 desimal)', () => {
    const summary = computeMonthlySummary({
      ...base,
      today: '2026-10-08', // hari kerja lewat: 1,2,5,6,7 = 5
      records: [
        record('2026-10-01', 'PRESENT', 0, 540),
        record('2026-10-02', 'LATE', 20, 500),
        record('2026-10-05', 'ABSENT', 0, 0),
        record('2026-10-06', 'SICK', 0, 0),
        record('2026-10-07', 'PRESENT', 0, 530),
      ],
    });
    expect(summary).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      sick: 1,
      permit: 0,
      leave: 0,
      totalLateMinutes: 20,
      totalWorkMinutes: 1570,
      workingDays: 5,
      attendanceRate: 60,
    });
  });

  it('hari ini dihitung hanya bila sudah ada record', () => {
    const records = [record('2026-10-01', 'PRESENT'), record('2026-10-02', 'PRESENT')];
    expect(computeMonthlySummary({ ...base, today: '2026-10-02', records }).workingDays).toBe(2);
    expect(
      computeMonthlySummary({ ...base, today: '2026-10-02', records: [records[0]] }).workingDays,
    ).toBe(1);
  });

  it('hari libur & akhir pekan tidak masuk penyebut; pembulatan 1 desimal', () => {
    const summary = computeMonthlySummary({
      ...base,
      holidays: new Set(['2026-10-02']),
      today: '2026-10-07', // lewat: 1, (2 libur), 5, 6 = 3 hari kerja
      records: [record('2026-10-01', 'PRESENT'), record('2026-10-05', 'LATE', 5)],
    });
    expect(summary.workingDays).toBe(3);
    expect(summary.attendanceRate).toBe(66.7);
  });

  it('tanpa shift / bulan depan → workingDays 0 & rate 0', () => {
    expect(
      computeMonthlySummary({ ...base, workDays: null, today: '2026-10-20', records: [] }),
    ).toMatchObject({
      workingDays: 0,
      attendanceRate: 0,
    });
    expect(
      computeMonthlySummary({
        ...base,
        range: { from: '2026-11-01', to: '2026-11-30' },
        today: '2026-10-20',
        records: [],
      }).workingDays,
    ).toBe(0);
  });

  it('karyawan baru: hari kerja sebelum bergabung tidak dihitung (hadir penuh = 100%)', () => {
    const summary = computeMonthlySummary({
      ...base,
      joinedOn: '2026-10-13',
      today: '2026-10-16',
      records: [
        record('2026-10-13', 'PRESENT'),
        record('2026-10-14', 'PRESENT'),
        record('2026-10-15', 'LATE', 10),
      ],
    });
    expect(summary).toMatchObject({ workingDays: 3, attendanceRate: 100 });
  });

  it('bergabung setelah periode → 0 hari dihitung', () => {
    expect(
      computeMonthlySummary({ ...base, joinedOn: '2026-11-03', today: '2026-11-10', records: [] }),
    ).toMatchObject({ workingDays: 0, attendanceRate: 0 });
  });

  it('riwayat sebelum akun dibuat (impor/seed): dihitung sejak record pertama', () => {
    expect(trackingStart(base.range, '2026-10-11', ['2026-10-05', '2026-10-06'])).toBe(
      '2026-10-05',
    );
    expect(trackingStart(base.range, '2026-09-01', [])).toBe('2026-10-01');
    expect(trackingStart(base.range, null, [])).toBe('2026-10-01');
    const summary = computeMonthlySummary({
      ...base,
      joinedOn: '2026-10-11',
      today: '2026-10-13',
      records: [record('2026-10-05', 'PRESENT'), record('2026-10-12', 'PRESENT')],
    });
    // 5,6,7,8,9,12 = 6 hari kerja sejak record pertama.
    expect(summary.workingDays).toBe(6);
  });

  it('absen manual di akhir pekan ikut penyebut → persentase tidak pernah > 100%', () => {
    const summary = computeMonthlySummary({
      ...base,
      today: '2026-11-03',
      range: { from: '2026-11-01', to: '2026-11-30' },
      records: [record('2026-11-01', 'PRESENT'), record('2026-11-02', 'PRESENT')],
    });
    expect(summary).toMatchObject({ present: 2, workingDays: 2, attendanceRate: 100 });
  });

  it('shift nonaktif: penyebut dari hari yang punya record (bukan 0%)', () => {
    const summary = computeMonthlySummary({
      ...base,
      workDays: null,
      today: '2026-10-20',
      records: [record('2026-10-01', 'PRESENT'), record('2026-10-02', 'ABSENT')],
    });
    expect(summary).toMatchObject({ workingDays: 2, attendanceRate: 50 });
  });

  it('ABSENT pada tanggal yang belakangan dijadikan libur tidak dihitung', () => {
    const summary = computeMonthlySummary({
      ...base,
      holidays: new Set(['2026-10-02']),
      today: '2026-10-06',
      records: [
        record('2026-10-01', 'PRESENT'),
        record('2026-10-02', 'ABSENT', 0, 0),
        record('2026-10-05', 'PRESENT'),
      ],
    });
    expect(summary).toMatchObject({ absent: 0, workingDays: 2, attendanceRate: 100 });
  });
});
