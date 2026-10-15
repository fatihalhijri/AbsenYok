import {
  CalendarCheck2Icon,
  ClockAlertIcon,
  FileHeartIcon,
  type LucideIcon,
  UserXIcon,
} from 'lucide-react';
import { ProgressRing } from '@/components/shared/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMinutes } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { MonthlySummary } from '@/types';

const TILES: {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: string;
  value: (summary: MonthlySummary) => number;
}[] = [
  {
    key: 'present',
    label: 'Hadir',
    icon: CalendarCheck2Icon,
    tone: 'text-primary',
    value: (s) => s.present,
  },
  {
    key: 'late',
    label: 'Terlambat',
    icon: ClockAlertIcon,
    tone: 'text-amber-600 dark:text-warning',
    value: (s) => s.late,
  },
  {
    key: 'leave',
    label: 'Izin/Sakit',
    icon: FileHeartIcon,
    tone: 'text-sky-600 dark:text-sky-300',
    value: (s) => s.sick + s.permit + s.leave,
  },
  {
    key: 'absent',
    label: 'Alpa',
    icon: UserXIcon,
    tone: 'text-destructive',
    value: (s) => s.absent,
  },
];

interface MonthSummaryProps {
  summary: MonthlySummary | undefined;
  loading?: boolean;
  /** Tampilkan total jam kerja & menit terlambat (halaman riwayat). */
  detailed?: boolean;
}

/** Ringkasan bulan: 4 kartu mini + cincin persentase kehadiran. */
export function MonthSummary({ summary, loading, detailed }: MonthSummaryProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
      {summary && !loading ? (
        <ProgressRing value={summary.attendanceRate} />
      ) : (
        <Skeleton className="size-24 shrink-0 rounded-full" />
      )}
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        {TILES.map(({ key, label, icon: Icon, tone, value }) => (
          <div key={key} className="min-w-0 rounded-lg bg-muted/50 px-2.5 py-1.5 leading-tight">
            <p className="flex items-center gap-1 text-[11px] whitespace-nowrap text-muted-foreground">
              <Icon className={cn('size-3.5 shrink-0', tone)} aria-hidden="true" />
              {label}
            </p>
            {summary && !loading ? (
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{value(summary)}</p>
            ) : (
              <Skeleton className="mt-1 h-5 w-6" />
            )}
          </div>
        ))}
        {detailed && summary && !loading ? (
          <p className="col-span-2 text-xs text-muted-foreground">
            Total kerja {formatMinutes(summary.totalWorkMinutes)} · terlambat{' '}
            {formatMinutes(summary.totalLateMinutes)} · {summary.workingDays} hari dihitung
          </p>
        ) : null}
      </div>
    </div>
  );
}
