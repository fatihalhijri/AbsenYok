import type { MonthlyReportRow } from '@/types';

/** Kolom angka yang dijumlahkan di baris total. */
export const SUMMED_KEYS = [
  'workingDays',
  'present',
  'late',
  'totalLateMinutes',
  'absent',
  'sick',
  'permit',
  'leave',
  'totalWorkMinutes',
] as const satisfies readonly (keyof MonthlyReportRow)[];

export type SummedKey = (typeof SUMMED_KEYS)[number];
export type ReportSortKey = SummedKey | 'employeeCode' | 'name' | 'department' | 'attendanceRate';

export interface ReportSort {
  key: ReportSortKey;
  desc: boolean;
}

/** (hadir + terlambat) / hari kerja × 100, 1 desimal, maks 100 — rumus backend `attendanceRate`. */
export function attendanceRate(present: number, late: number, workingDays: number): number {
  if (workingDays <= 0) return 0;
  return Math.min(100, Math.round(((present + late) / workingDays) * 1000) / 10);
}

export type ReportTotals = Record<SummedKey, number> & {
  employees: number;
  attendanceRate: number;
};

/** Baris total: jumlah tiap kolom + persentase kehadiran gabungan (bukan rata-rata persentase). */
export function reportTotals(rows: readonly MonthlyReportRow[]): ReportTotals {
  const sums = Object.fromEntries(
    SUMMED_KEYS.map((key) => [key, rows.reduce((total, row) => total + row[key], 0)]),
  ) as Record<SummedKey, number>;
  return {
    ...sums,
    employees: rows.length,
    attendanceRate: attendanceRate(sums.present, sums.late, sums.workingDays),
  };
}

const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true });

/** Urutkan salinan baris (teks: urutan alfabet Indonesia; departemen kosong selalu di akhir). */
export function sortReportRows(
  rows: readonly MonthlyReportRow[],
  { key, desc }: ReportSort,
): MonthlyReportRow[] {
  const direction = desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (left == null || right == null) {
      if (left == null && right == null) return collator.compare(a.name, b.name);
      return left == null ? 1 : -1;
    }
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : collator.compare(String(left), String(right));
    // Nilai sama → urut nama agar stabil & mudah dibaca.
    return result === 0 ? collator.compare(a.name, b.name) : result * direction;
  });
}

export const NO_DEPARTMENT = 'Tanpa departemen';

export interface DepartmentRate {
  department: string;
  employees: number;
  present: number;
  late: number;
  workingDays: number;
  attendanceRate: number;
}

/** Persentase kehadiran per departemen (dari hari kerja gabungan), tertinggi dulu. */
export function departmentRates(rows: readonly MonthlyReportRow[]): DepartmentRate[] {
  const groups = new Map<string, DepartmentRate>();
  for (const row of rows) {
    const department = row.department || NO_DEPARTMENT;
    const group = groups.get(department) ?? {
      department,
      employees: 0,
      present: 0,
      late: 0,
      workingDays: 0,
      attendanceRate: 0,
    };
    group.employees += 1;
    group.present += row.present;
    group.late += row.late;
    group.workingDays += row.workingDays;
    groups.set(department, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      attendanceRate: attendanceRate(group.present, group.late, group.workingDays),
    }))
    .sort(
      (a, b) => b.attendanceRate - a.attendanceRate || collator.compare(a.department, b.department),
    );
}
