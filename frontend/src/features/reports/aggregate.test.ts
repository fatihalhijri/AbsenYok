import { describe, expect, it } from 'vitest';
import type { MonthlyReportRow } from '@/types';
import { attendanceRate, departmentRates, reportTotals, sortReportRows } from './aggregate';

function row(overrides: Partial<MonthlyReportRow>): MonthlyReportRow {
  return {
    userId: overrides.employeeCode ?? 'u',
    employeeCode: 'EMP000',
    name: 'Karyawan',
    department: null,
    workingDays: 20,
    present: 18,
    late: 0,
    totalLateMinutes: 0,
    absent: 0,
    sick: 0,
    permit: 0,
    leave: 0,
    totalWorkMinutes: 9000,
    attendanceRate: 90,
    ...overrides,
  };
}

const ROWS = [
  row({ employeeCode: 'EMP003', name: 'Citra', department: 'Keuangan', present: 10, late: 5 }),
  row({ employeeCode: 'EMP001', name: 'Budi', department: 'IT', present: 20, late: 0 }),
  row({ employeeCode: 'EMP002', name: 'ani', department: 'IT', present: 14, late: 2 }),
  row({ employeeCode: 'EMP004', name: 'Dodi', department: null, present: 0, workingDays: 0 }),
];

describe('attendanceRate', () => {
  it('1 desimal, maks 100, hari kerja 0 → 0', () => {
    expect(attendanceRate(15, 2, 22)).toBe(77.3);
    expect(attendanceRate(25, 0, 20)).toBe(100);
    expect(attendanceRate(0, 0, 0)).toBe(0);
  });
});

describe('reportTotals', () => {
  it('menjumlahkan kolom & menghitung persentase gabungan (bukan rata-rata persen)', () => {
    const totals = reportTotals(ROWS);
    expect(totals).toMatchObject({ employees: 4, present: 44, late: 7, workingDays: 60 });
    expect(totals.attendanceRate).toBe(85);
  });

  it('tanpa baris → nol semua', () => {
    expect(reportTotals([])).toMatchObject({ employees: 0, present: 0, attendanceRate: 0 });
  });
});

describe('departmentRates', () => {
  it('mengelompokkan per departemen; tanpa departemen digabung; tertinggi dulu', () => {
    expect(departmentRates(ROWS)).toEqual([
      {
        department: 'IT',
        employees: 2,
        present: 34,
        late: 2,
        workingDays: 40,
        attendanceRate: 90,
      },
      {
        department: 'Keuangan',
        employees: 1,
        present: 10,
        late: 5,
        workingDays: 20,
        attendanceRate: 75,
      },
      {
        department: 'Tanpa departemen',
        employees: 1,
        present: 0,
        late: 0,
        workingDays: 0,
        attendanceRate: 0,
      },
    ]);
  });
});

describe('sortReportRows', () => {
  it('teks tanpa membedakan huruf besar; angka; departemen kosong di akhir', () => {
    expect(sortReportRows(ROWS, { key: 'name', desc: false }).map((r) => r.name)).toEqual([
      'ani',
      'Budi',
      'Citra',
      'Dodi',
    ]);
    expect(sortReportRows(ROWS, { key: 'present', desc: true }).map((r) => r.present)).toEqual([
      20, 14, 10, 0,
    ]);
    expect(
      sortReportRows(ROWS, { key: 'department', desc: true }).map((r) => r.department),
    ).toEqual(['Keuangan', 'IT', 'IT', null]);
  });

  it('tidak mengubah array asal', () => {
    const copy = [...ROWS];
    sortReportRows(ROWS, { key: 'late', desc: true });
    expect(ROWS).toEqual(copy);
  });
});
