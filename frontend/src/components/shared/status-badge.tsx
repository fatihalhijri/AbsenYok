import { cn } from '@/lib/utils';
import type { AttendanceStatus, LeaveStatus } from '@/types';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'cyan' | 'gray';

/** Warna konsisten light/dark; teks ≥ 600 di atas latar 50/100 → kontras AA. */
const TONE_CLASSES: Record<Tone, string> = {
  green:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25',
  amber:
    'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/25',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/25',
  violet:
    'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/25',
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-600/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25',
  gray: 'bg-muted text-muted-foreground ring-border',
};

const DOT_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  gray: 'bg-muted-foreground/60',
};

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, { label: string; tone: Tone }> = {
  PRESENT: { label: 'Hadir', tone: 'green' },
  LATE: { label: 'Terlambat', tone: 'amber' },
  ABSENT: { label: 'Alpa', tone: 'red' },
  SICK: { label: 'Sakit', tone: 'blue' },
  PERMIT: { label: 'Izin', tone: 'violet' },
  LEAVE: { label: 'Cuti', tone: 'cyan' },
};

export const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Menunggu', tone: 'gray' },
  APPROVED: { label: 'Disetujui', tone: 'green' },
  REJECTED: { label: 'Ditolak', tone: 'red' },
  CANCELLED: { label: 'Dibatalkan', tone: 'gray' },
};

type StatusBadgeProps = { className?: string } & (
  { kind?: 'attendance'; status: AttendanceStatus } | { kind: 'leave'; status: LeaveStatus }
);

/** Lencana status absensi (default) atau status pengajuan izin (`kind="leave"`). */
export function StatusBadge(props: StatusBadgeProps) {
  const meta =
    props.kind === 'leave' ? LEAVE_STATUS_META[props.status] : ATTENDANCE_STATUS_META[props.status];
  return (
    <span
      data-status={props.status}
      className={cn(
        'inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_CLASSES[meta.tone],
        props.className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT_CLASSES[meta.tone])} />
      {meta.label}
    </span>
  );
}
