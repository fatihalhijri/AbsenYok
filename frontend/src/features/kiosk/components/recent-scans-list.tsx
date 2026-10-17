'use client';

import { LogInIcon, LogOutIcon, UserIcon, UsersIcon } from 'lucide-react';
import { initialsOf } from '@/components/layout/user-menu';
import { StatusBadge } from '@/components/shared/status-badge';
import { AvatarPhoto } from '@/components/shared/avatar-photo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AttendanceStatus, RecentScan } from '@/types';

/** "Baru saja absen": 10 terakhir; entri baru masuk dari atas & disorot sebentar. */
export function RecentScansList({
  items,
  highlighted,
  loading,
}: {
  items: RecentScan[];
  highlighted: ReadonlySet<string>;
  loading: boolean;
}) {
  return (
    <section aria-labelledby="recent-scans-title" className="flex min-h-0 flex-1 flex-col gap-3">
      <h2
        id="recent-scans-title"
        className="text-sm font-semibold tracking-widest text-muted-foreground uppercase"
      >
        Baru saja absen
      </h2>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
          <UsersIcon className="size-10" aria-hidden="true" />
          <p className="text-lg">Belum ada yang absen hari ini.</p>
        </div>
      ) : (
        <ol className="min-h-0 space-y-2 overflow-hidden" aria-live="polite">
          {items.map((scan) => (
            <ScanRow key={scan.id} scan={scan} highlighted={highlighted.has(scan.id)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ScanRow({ scan, highlighted }: { scan: RecentScan; highlighted: boolean }) {
  const checkIn = scan.type === 'CHECK_IN';
  return (
    <li
      data-scan-id={scan.id}
      data-highlighted={highlighted || undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-colors duration-700',
        'animate-in duration-500 fade-in slide-in-from-top-4',
        highlighted && 'border-primary/60 bg-primary/15 ring-2 ring-primary/40',
      )}
    >
      <Avatar className="size-12 shrink-0">
        {scan.avatarUrl ? <AvatarPhoto src={scan.avatarUrl} size={48} /> : null}
        <AvatarFallback className="bg-primary/15 font-semibold text-primary">
          {initialsOf(scan.name) || <UserIcon className="size-5" aria-hidden="true" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{scan.name}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatTime(scan.time)} · {scan.employeeCode}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            checkIn ? 'bg-emerald-400/15 text-emerald-300' : 'bg-sky-400/15 text-sky-300',
          )}
        >
          {checkIn ? (
            <LogInIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <LogOutIcon className="size-3.5" aria-hidden="true" />
          )}
          {checkIn ? 'Masuk' : 'Pulang'}
        </span>
        {scan.status ? <StatusBadge status={scan.status as AttendanceStatus} /> : null}
      </div>
    </li>
  );
}
