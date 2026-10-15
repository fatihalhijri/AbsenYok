'use client';

import { attendanceDotClass, ATTENDANCE_STATUS_META } from '@/components/shared/status-badge';
import { datesInMonth, dayjs, isoWeekdayOf } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Attendance, AttendanceStatus, Holiday } from '@/types';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface AttendanceCalendarProps {
  month: string;
  records: Map<string, Attendance>;
  holidays: Map<string, Holiday>;
  /** ISO weekday hari kerja shift (kosong = tidak diketahui). */
  workDays: number[];
  /** Tanggal hari ini (`YYYY-MM-DD`). */
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
}

/** Grid kalender satu bulan (Senin pertama): titik warna = status, merah = hari libur. */
export function AttendanceCalendar({
  month,
  records,
  holidays,
  workDays,
  today,
  selected,
  onSelect,
}: AttendanceCalendarProps) {
  const dates = datesInMonth(month);
  const leadingBlanks = isoWeekdayOf(dates[0]) - 1;

  return (
    <div className="space-y-3">
      <div role="grid" aria-label={`Kalender absensi ${dayjs(month).format('MMMM YYYY')}`}>
        <div
          role="row"
          className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground"
        >
          {WEEKDAYS.map((day) => (
            <span key={day} role="columnheader" className="py-2">
              {day}
            </span>
          ))}
        </div>
        <div role="row" className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden="true" />
          ))}
          {dates.map((date) => {
            const record = records.get(date);
            const holiday = holidays.get(date);
            const weekday = isoWeekdayOf(date);
            const offDay = workDays.length > 0 && !workDays.includes(weekday);
            const future = date > today;
            const status = record?.status as AttendanceStatus | undefined;
            const label = [
              dayjs(date).format('dddd, D MMMM'),
              status ? ATTENDANCE_STATUS_META[status].label : null,
              holiday ? `Libur: ${holiday.name}` : null,
              !status && !holiday && offDay ? 'Bukan hari kerja' : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                aria-label={label}
                aria-selected={selected === date}
                aria-current={date === today ? 'date' : undefined}
                onClick={() => onSelect(date)}
                className={cn(
                  'relative flex aspect-square min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-sm tabular-nums outline-none',
                  'hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected === date && 'bg-accent ring-2 ring-primary',
                  date === today && 'font-bold text-primary',
                  (offDay || future) && !record && !holiday && 'text-muted-foreground/60',
                  holiday && 'text-destructive',
                )}
              >
                {dayjs(date).date()}
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    status
                      ? attendanceDotClass(status)
                      : holiday
                        ? 'bg-destructive/60'
                        : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        aria-label="Keterangan"
      >
        {(Object.keys(ATTENDANCE_STATUS_META) as AttendanceStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              className={cn('size-2 rounded-full', attendanceDotClass(status))}
              aria-hidden="true"
            />
            {ATTENDANCE_STATUS_META[status].label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-destructive/60" aria-hidden="true" />
          Libur
        </li>
      </ul>
    </div>
  );
}
