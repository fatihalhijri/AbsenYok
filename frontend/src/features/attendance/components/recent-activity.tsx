import { ChevronRightIcon, HistoryIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDayShort, formatTime } from '@/lib/date';
import type { Attendance, AttendanceStatus } from '@/types';

/** Jam masuk–pulang ringkas ("07:55 – 17:02", "07:55 – …", atau "—"). */
export function timeRange(attendance: Attendance): string {
  if (!attendance.checkInAt) return '—';
  const out = attendance.checkOutAt ? formatTime(attendance.checkOutAt) : '…';
  return `${formatTime(attendance.checkInAt)} – ${out}`;
}

/** 5 catatan absensi terakhir + tautan ke riwayat. */
export function RecentActivity({ items, loading }: { items: Attendance[]; loading?: boolean }) {
  return (
    <section aria-labelledby="recent-heading" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id="recent-heading" className="font-semibold">
          Aktivitas terakhir
        </h2>
        <Link
          href="/app/history"
          className="inline-flex min-h-11 items-center gap-0.5 rounded-md px-1 text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Lihat semua
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="rounded-xl border py-8"
          icon={HistoryIcon}
          title="Belum ada aktivitas"
          description="Riwayat absensi Anda akan tampil di sini."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatDayShort(item.date)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{timeRange(item)}</p>
              </div>
              <StatusBadge status={item.status as AttendanceStatus} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
