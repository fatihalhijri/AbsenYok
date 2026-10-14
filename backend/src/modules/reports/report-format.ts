import { isoWeekday } from '@/common/utils/date.util';

/** Kode matriks "Detail Harian" (legenda ditulis di bawah tabel). */
export const STATUS_CODES: Record<string, string> = {
  PRESENT: 'H',
  LATE: 'T',
  ABSENT: 'A',
  SICK: 'S',
  PERMIT: 'I',
  LEAVE: 'C',
};
export const HOLIDAY_CODE = 'L';
export const NO_DATA_CODE = '-';

export const CODE_LEGEND: [string, string][] = [
  ['H', 'Hadir tepat waktu'],
  ['T', 'Terlambat'],
  ['A', 'Alpa (tidak hadir tanpa keterangan)'],
  ['S', 'Sakit'],
  ['I', 'Izin'],
  ['C', 'Cuti'],
  ['L', 'Libur'],
  ['-', 'Hari kerja tanpa data'],
];

export const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Hadir',
  LATE: 'Terlambat',
  ABSENT: 'Alpa',
  SICK: 'Sakit',
  PERMIT: 'Izin',
  LEAVE: 'Cuti',
};

const LEAVE_TYPE_LABELS: Record<string, string> = { SICK: 'Sakit', PERMIT: 'Izin', ANNUAL: 'Cuti' };

const METHOD_LABELS: Record<string, string> = {
  KIOSK_QR: 'Kiosk',
  PERSONAL_QR: 'QR Personal',
  MANUAL: 'Manual',
};

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DAY_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** `'2026-10'` → `'Oktober 2026'` */
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${MONTHS[monthNumber - 1]} ${year}`;
}

/** `'2026-10-19'` → `'19 Oktober 2026'` */
export function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export const dayShort = (date: string) => DAY_SHORT[isoWeekday(date) - 1];
export const dayLong = (date: string) => DAY_LONG[isoWeekday(date) - 1];

export const leaveTypeLabel = (type: string) => LEAVE_TYPE_LABELS[type] ?? type;
export const methodLabel = (method: string | null) =>
  method ? (METHOD_LABELS[method] ?? method) : '';

/** 553 → "9:13" (jam:menit) untuk kolom total jam kerja. */
export function hoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

/** Nama file aman (hanya huruf/angka/-/_). */
export const safeFilePart = (value: string) => value.replace(/[^A-Za-z0-9_-]+/g, '-');
