import { CalendarSearchIcon, ChevronRightIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDateLong, formatMinutes } from '@/lib/date';
import type { Attendance, AttendanceStatus } from '@/types';
import { timeRange } from '../components/recent-activity';

/** Daftar kartu per hari (terbaru di atas); ketuk → detail. */
export function AttendanceDayList({
  items,
  onSelect,
}: {
  items: Attendance[];
  onSelect: (date: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        className="rounded-xl border"
        icon={CalendarSearchIcon}
        title="Belum ada data absensi"
        description="Tidak ada catatan absensi pada bulan ini."
      />
    );
  }
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ul className="space-y-2">
      {sorted.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item.date)}
            className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">{formatDateLong(item.date)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {timeRange(item)}
                {item.workMinutes > 0 ? ` · ${formatMinutes(item.workMinutes)}` : ''}
                {item.lateMinutes > 0 ? ` · terlambat ${formatMinutes(item.lateMinutes)}` : ''}
              </p>
            </div>
            <StatusBadge status={item.status as AttendanceStatus} />
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
