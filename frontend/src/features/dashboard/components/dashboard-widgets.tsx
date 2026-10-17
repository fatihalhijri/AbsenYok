'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightIcon,
  ClockAlertIcon,
  InboxIcon,
  LogInIcon,
  LogOutIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { initialsOf } from '@/components/layout/user-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { AvatarPhoto } from '@/components/shared/avatar-photo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LEAVE_TYPE_META } from '@/features/leave/meta';
import { useToday } from '@/hooks/use-today';
import {
  formatDateShort,
  formatMinutes,
  formatMonth,
  formatRelative,
  formatTime,
} from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '@/types';
import { dashboardApi, dashboardKeys } from '../api';

/** Refetch feed aktivitas (prompt: 15 detik). */
const ACTIVITY_REFRESH_MS = 15_000;

function PersonAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-8', className)}>
      {avatarUrl ? <AvatarPhoto src={avatarUrl} size={32} /> : null}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
        {initialsOf(name) || <UserIcon className="size-4" aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Top 10 karyawan paling sering terlambat bulan ini. */
export function LateRankingCard() {
  const today = useToday();
  const month = today?.slice(0, 7) ?? null;
  const ranking = useQuery({
    queryKey: dashboardKeys.lateRanking(month ?? ''),
    queryFn: () => dashboardApi.lateRanking(month ?? ''),
    enabled: month !== null,
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Top 10 terlambat</CardTitle>
        <CardDescription>{month ? formatMonth(month) : '—'}</CardDescription>
      </CardHeader>
      <CardContent>
        {ranking.isPending ? (
          <ListSkeleton />
        ) : ranking.isError ? (
          <ErrorState
            message={getErrorMessage(ranking.error)}
            onRetry={() => void ranking.refetch()}
          />
        ) : ranking.data.length === 0 ? (
          <EmptyState
            icon={ClockAlertIcon}
            title="Belum ada keterlambatan"
            description="Bagus! Tidak ada yang terlambat bulan ini."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead className="w-24 text-right">Terlambat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.data.map((row) => (
                <TableRow key={row.user.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{row.rank}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/employees/${row.user.id}`}
                      className="flex items-center gap-2 rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <PersonAvatar name={row.user.name} avatarUrl={row.user.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.user.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.user.employeeCode}
                          {row.user.department ? ` · ${row.user.department}` : ''}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <span className="block font-medium">{row.lateCount}×</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatMinutes(row.totalLateMinutes)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** 20 scan terbaru, diperbarui tiap 15 detik. */
export function RecentActivityCard() {
  const activity = useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn: dashboardApi.activity,
    refetchInterval: ACTIVITY_REFRESH_MS,
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Aktivitas terkini</CardTitle>
        <CardDescription>Diperbarui otomatis setiap 15 detik.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.isPending ? (
          <ListSkeleton rows={6} />
        ) : activity.isError ? (
          <ErrorState
            message={getErrorMessage(activity.error)}
            onRetry={() => void activity.refetch()}
          />
        ) : activity.data.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="Belum ada aktivitas"
            description="Scan absensi hari ini akan tampil di sini."
          />
        ) : (
          <ol className="max-h-96 space-y-1 overflow-y-auto pr-1" aria-live="polite">
            {activity.data.map((item) => {
              const checkIn = item.type === 'CHECK_IN';
              return (
                <li
                  key={`${item.attendanceId}-${item.type}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                >
                  <PersonAvatar name={item.user.name} avatarUrl={item.user.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {checkIn ? (
                          <LogInIcon className="size-3" aria-hidden="true" />
                        ) : (
                          <LogOutIcon className="size-3" aria-hidden="true" />
                        )}
                        {checkIn ? 'Masuk' : 'Pulang'} {formatTime(item.time)}
                      </span>
                      {item.kiosk
                        ? ` · ${item.kiosk.name}`
                        : item.method === 'PERSONAL_QR'
                          ? ' · QR personal'
                          : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={item.status as AttendanceStatus} />
                    <time className="text-[11px] text-muted-foreground" dateTime={item.time}>
                      {formatRelative(item.time)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Jumlah pengajuan PENDING + 5 terbaru + tombol tinjau. */
export function PendingLeavesCard() {
  const pending = useQuery({
    queryKey: dashboardKeys.pendingLeaves(),
    queryFn: dashboardApi.pendingLeaves,
  });
  const total = pending.data?.meta.total ?? 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pengajuan menunggu
          {pending.data ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                total > 0
                  ? 'bg-warning/20 text-amber-800 dark:text-warning'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {total}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>Izin, sakit, dan cuti yang perlu ditinjau.</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/leave-requests?status=PENDING">
              Tinjau
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {pending.isPending ? (
          <ListSkeleton />
        ) : pending.isError ? (
          <ErrorState
            message={getErrorMessage(pending.error)}
            onRetry={() => void pending.refetch()}
          />
        ) : pending.data.items.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="Tidak ada pengajuan"
            description="Semua pengajuan sudah ditinjau."
          />
        ) : (
          <ul className="divide-y">
            {pending.data.items.map((leave) => (
              <li key={leave.id} className="flex items-center gap-3 py-2.5">
                <PersonAvatar name={leave.user.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{leave.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {LEAVE_TYPE_META[leave.type].label} · {formatDateShort(leave.startDate)}
                    {leave.endDate !== leave.startDate
                      ? ` – ${formatDateShort(leave.endDate)}`
                      : ''}{' '}
                    · {leave.totalDays} hari
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
