/** Utilitas form shift (preview teks & konversi hari kerja). */

export const WEEKDAYS = [
  { value: 1, short: 'Sen', long: 'Senin' },
  { value: 2, short: 'Sel', long: 'Selasa' },
  { value: 3, short: 'Rab', long: 'Rabu' },
  { value: 4, short: 'Kam', long: 'Kamis' },
  { value: 5, short: 'Jum', long: 'Jumat' },
  { value: 6, short: 'Sab', long: 'Sabtu' },
  { value: 7, short: 'Min', long: 'Minggu' },
] as const;

const LONG = Object.fromEntries(WEEKDAYS.map((day) => [day.value, day.long])) as Record<
  number,
  string
>;

/** `[5,1,3]` → `"1,3,5"` (format backend, terurut & unik). */
export const toWorkDaysString = (days: number[]) =>
  [...new Set(days)].sort((a, b) => a - b).join(',');

/**
 * Hari kerja dalam kalimat: rentang berurutan diringkas.
 * `[1,2,3,4,5]` → "Senin–Jumat"; `[1,3,5]` → "Senin, Rabu, Jumat"; `[1,2,3,5,6]` → "Senin–Rabu, Jumat, Sabtu" (rentang ≥ 3 hari).
 */
export function describeWorkDays(days: number[]): string {
  const sorted = [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return 'Tanpa hari kerja';
  if (sorted.length === 7) return 'Setiap hari';
  const groups: number[][] = [];
  for (const day of sorted) {
    const last = groups.at(-1);
    if (last && day === (last.at(-1) ?? 0) + 1) last.push(day);
    else groups.push([day]);
  }
  return groups
    .map((group) =>
      group.length >= 3
        ? `${LONG[group[0] ?? 1]}–${LONG[group.at(-1) ?? 1]}`
        : group.map((day) => LONG[day]).join(', '),
    )
    .join(', ');
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const fromMinutes = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

/** Jam absen masuk mulai dibuka (`startTime − checkInOpenMinutes`); null bila sebelum 00:00. */
export function checkInOpensAt(startTime: string, checkInOpenMinutes: number): string | null {
  const minutes = toMinutes(startTime) - checkInOpenMinutes;
  return minutes < 0 ? null : fromMinutes(minutes);
}

/** "Senin–Jumat, 08:00–17:00, toleransi 15 menit, absen dibuka 07:00". */
export function shiftPreview(shift: {
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  checkInOpenMinutes: number;
  workDays: number[];
}): string {
  const opens = checkInOpensAt(shift.startTime, shift.checkInOpenMinutes);
  return [
    describeWorkDays(shift.workDays),
    `${shift.startTime}–${shift.endTime}`,
    `toleransi ${shift.lateToleranceMinutes} menit`,
    opens ? `absen dibuka ${opens}` : 'absen dibuka sebelum 00:00 (tidak valid)',
  ].join(', ');
}

export const isTimeAfter = (end: string, start: string) => toMinutes(end) > toMinutes(start);
