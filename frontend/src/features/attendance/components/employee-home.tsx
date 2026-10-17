'use client';

import { useQueryClient } from '@tanstack/react-query';
import { RefreshCwIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { ErrorState } from '@/components/shared/error-state';
import { InstallBanner } from '@/components/shared/install-banner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/error';
import { shiftMonth } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { attendanceKeys } from '../api';
import { useMyMonth, useMyToday } from '../hooks';
import { Greeting } from './greeting';
import { MonthSummary } from './month-summary';
import { RecentActivity } from './recent-activity';
import { ShiftInfo } from './shift-info';
import { TodayStatusCard } from './today-status-card';

const RECENT_LIMIT = 5;

/** Beranda karyawan. Waktu live diisolasi di Greeting/LiveClock/LiveDuration/Countdown. */
export function EmployeeHome() {
  const queryClient = useQueryClient();
  const name = useAuthStore((state) => state.user?.name);
  const today = useMyToday();
  const month = today.data?.date.slice(0, 7) ?? null;
  const thisMonth = useMyMonth(month);
  // Awal bulan → lengkapi "aktivitas terakhir" dari bulan sebelumnya.
  const needPrevious = thisMonth.isSuccess && thisMonth.data.items.length < RECENT_LIMIT;
  const previousMonth = useMyMonth(month ? shiftMonth(month, -1) : null, { enabled: needPrevious });

  const recent = useMemo(
    () =>
      [...(thisMonth.data?.items ?? []), ...(needPrevious ? (previousMonth.data?.items ?? []) : [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, RECENT_LIMIT),
    [needPrevious, previousMonth.data, thisMonth.data],
  );

  const { refetch: refetchToday } = today;
  const refreshToday = useCallback(() => void refetchToday(), [refetchToday]);
  const refreshAll = () => void queryClient.invalidateQueries({ queryKey: attendanceKeys.mine() });
  const refreshing = today.isFetching || thisMonth.isFetching;

  return (
    <div className="space-y-5">
      <Greeting name={name} offsetMs={today.clockOffsetMs} />

      <InstallBanner />

      {today.isPending ? (
        <Skeleton className="h-52 w-full rounded-2xl" />
      ) : today.isError ? (
        <ErrorState
          className="rounded-2xl border"
          message={getErrorMessage(today.error)}
          onRetry={refreshToday}
        />
      ) : (
        <>
          <TodayStatusCard
            today={today.data}
            offsetMs={today.clockOffsetMs}
            onRefresh={refreshToday}
          />
          {today.data.shift ? <ShiftInfo shift={today.data.shift} /> : null}
        </>
      )}

      <section aria-labelledby="month-heading" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="month-heading" className="font-semibold">
            Ringkasan bulan ini
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-muted-foreground"
            onClick={refreshAll}
            disabled={refreshing}
            aria-label="Perbarui data absensi"
          >
            <RefreshCwIcon className={cn(refreshing && 'animate-spin')} aria-hidden="true" />
            Perbarui
          </Button>
        </div>
        {thisMonth.isError ? (
          <ErrorState
            className="rounded-2xl border py-6"
            message={getErrorMessage(thisMonth.error)}
            onRetry={() => void thisMonth.refetch()}
          />
        ) : (
          <MonthSummary summary={thisMonth.data?.summary} loading={thisMonth.isPending} />
        )}
      </section>

      <RecentActivity
        items={recent}
        loading={thisMonth.isPending || (needPrevious && previousMonth.isPending)}
      />
    </div>
  );
}
