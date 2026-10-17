import type { ChartConfig } from '@/components/ui/chart';

/**
 * Seri status kehadiran di grafik. Urutan TETAP (Hadir, Izin/Cuti, Terlambat, Alpa) — urutan ini
 * yang lolos validasi CVD dataviz di tema terang & gelap (pasangan bersebelahan cukup berbeda).
 * Warna mengikuti entitas, bukan peringkat: jangan diurutkan ulang per data.
 */
export const STATUS_SERIES = [
  { key: 'present', label: 'Hadir', color: 'var(--chart-present)' },
  { key: 'leave', label: 'Izin/Cuti', color: 'var(--chart-leave)' },
  { key: 'late', label: 'Terlambat', color: 'var(--chart-late)' },
  { key: 'absent', label: 'Alpa', color: 'var(--chart-absent)' },
] as const;

export type StatusSeriesKey = (typeof STATUS_SERIES)[number]['key'];

export const STATUS_CHART_CONFIG = Object.fromEntries(
  STATUS_SERIES.map(({ key, label, color }) => [key, { label, color }]),
) satisfies ChartConfig;
