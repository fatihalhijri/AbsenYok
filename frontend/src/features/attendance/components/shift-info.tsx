import { BriefcaseBusinessIcon } from 'lucide-react';
import type { TodayShift } from '@/types';

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** "1,2,3,4,5" → "Sen–Jum"; selain rentang berurutan → "Sen, Rab, Jum". */
export function formatWorkDays(workDays: string): string {
  const days = workDays
    .split(',')
    .map(Number)
    .filter((day) => day >= 1 && day <= 7)
    .sort((a, b) => a - b);
  if (days.length === 0) return '-';
  const consecutive = days.every((day, index) => index === 0 || day === days[index - 1] + 1);
  return consecutive && days.length > 2
    ? `${DAY_NAMES[days[0] - 1]}–${DAY_NAMES[days.at(-1)! - 1]}`
    : days.map((day) => DAY_NAMES[day - 1]).join(', ');
}

/** Info shift: nama, jam kerja, toleransi terlambat, hari kerja. */
export function ShiftInfo({ shift }: { shift: TodayShift }) {
  return (
    <section
      aria-label="Shift Anda"
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
    >
      <BriefcaseBusinessIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Shift {shift.name} · {shift.startTime}–{shift.endTime}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatWorkDays(shift.workDays)} · toleransi terlambat {shift.lateToleranceMinutes} menit
        </p>
      </div>
    </section>
  );
}
