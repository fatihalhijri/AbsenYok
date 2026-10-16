'use client';

import { CalendarHeartIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveQuota } from '@/types';

/** Sisa cuti tahunan + progress bar pemakaian (disetujui) dan yang masih menunggu. */
export function QuotaCard({
  quota,
  loading,
}: {
  quota: LeaveQuota | undefined;
  loading?: boolean;
}) {
  if (loading || !quota) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }
  const usedPercent = quota.quota > 0 ? Math.min(100, (quota.used / quota.quota) * 100) : 0;
  return (
    <section
      aria-label="Sisa cuti tahunan"
      className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-800 dark:text-cyan-300">
          <CalendarHeartIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Sisa cuti tahunan {quota.year}</p>
          <p className="text-2xl leading-tight font-semibold tabular-nums">
            {quota.remaining}
            <span className="text-base font-normal text-muted-foreground">
              {' '}
              / {quota.quota} hari
            </span>
          </p>
        </div>
      </div>
      <Progress
        value={usedPercent}
        className="h-2"
        aria-label={`Terpakai ${quota.used} dari ${quota.quota} hari`}
      />
      <p className="text-xs text-muted-foreground">
        Terpakai {quota.used} hari
        {quota.pending > 0 ? ` · ${quota.pending} hari menunggu persetujuan` : ''}
      </p>
    </section>
  );
}
