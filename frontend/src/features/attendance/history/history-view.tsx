'use client';

import { useMutation } from '@tanstack/react-query';
import { DownloadIcon, Loader2Icon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/shared/error-state';
import { MonthPicker } from '@/components/shared/month-picker';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHolidays } from '@/features/holidays/hooks';
import { reportsApi } from '@/features/reports/api';
import { useToday } from '@/hooks/use-today';
import { getErrorMessage } from '@/lib/error';
import { isoWeekdayOf } from '@/lib/date';
import type { Attendance, Holiday } from '@/types';
import { useMyMonth, useMyToday } from '../hooks';
import { MonthSummary } from '../components/month-summary';
import { AttendanceCalendar } from './attendance-calendar';
import { AttendanceDayList } from './attendance-day-list';
import { DayDetailSheet } from './day-detail-sheet';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Riwayat absensi per bulan (`?month=YYYY-MM`, default bulan berjalan). */
export function HistoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = useToday();
  const currentMonth = today?.slice(0, 7) ?? null;
  const requested = searchParams.get('month');
  const month =
    requested && MONTH_PATTERN.test(requested) && currentMonth && requested <= currentMonth
      ? requested
      : currentMonth;

  const history = useMyMonth(month);
  const holidaysQuery = useHolidays(month ? Number(month.slice(0, 4)) : null);
  const myToday = useMyToday();
  const [selected, setSelected] = useState<string | null>(null);

  const records = useMemo(
    () => new Map<string, Attendance>((history.data?.items ?? []).map((item) => [item.date, item])),
    [history.data],
  );
  const holidays = useMemo(
    () =>
      new Map<string, Holiday>(
        (holidaysQuery.data ?? [])
          .filter((holiday) => month && holiday.date.startsWith(month))
          .map((holiday) => [holiday.date, holiday]),
      ),
    [holidaysQuery.data, month],
  );
  const workDays = useMemo(
    () => myToday.data?.shift?.workDays.split(',').map(Number) ?? [],
    [myToday.data],
  );

  const download = useMutation({
    mutationFn: (value: string) => reportsApi.downloadMyMonthly(value),
    onSuccess: (filename) => toast.success('Laporan diunduh', { description: filename }),
    onError: (error) =>
      toast.error('Gagal mengunduh laporan', { description: getErrorMessage(error) }),
  });

  const changeMonth = (value: string) => {
    setSelected(null);
    router.replace(`${pathname}?month=${value}`, { scroll: false });
  };

  if (!month || !today) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Riwayat</h1>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => download.mutate(month)}
          disabled={download.isPending}
        >
          {download.isPending ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : (
            <DownloadIcon aria-hidden="true" />
          )}
          Unduh PDF
        </Button>
      </div>

      <MonthPicker
        value={month}
        onChange={changeMonth}
        maxMonth={currentMonth ?? undefined}
        className="justify-center [&>button:nth-child(2)]:flex-1"
      />

      {history.isError ? (
        <ErrorState
          className="rounded-2xl border"
          message={getErrorMessage(history.error)}
          onRetry={() => void history.refetch()}
        />
      ) : (
        <>
          <MonthSummary summary={history.data?.summary} loading={history.isPending} detailed />

          <Tabs defaultValue="calendar" className="gap-3">
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="calendar">Kalender</TabsTrigger>
              <TabsTrigger value="list">Daftar</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar" className="rounded-2xl border bg-card p-3">
              {history.isPending ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <AttendanceCalendar
                  month={month}
                  records={records}
                  holidays={holidays}
                  workDays={workDays}
                  today={today}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}
            </TabsContent>
            <TabsContent value="list">
              {history.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <AttendanceDayList items={history.data.items} onSelect={setSelected} />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <DayDetailSheet
        date={selected}
        record={selected ? records.get(selected) : undefined}
        holiday={selected ? holidays.get(selected) : undefined}
        offDay={
          selected !== null && workDays.length > 0 && !workDays.includes(isoWeekdayOf(selected))
        }
        future={selected !== null && selected > today}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
