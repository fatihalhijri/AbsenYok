'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckCircle2Icon, ScrollTextIcon } from 'lucide-react';
import { useMemo } from 'react';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { OptionSelect } from '@/components/shared/option-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  attendanceAdminApi,
  attendanceAdminKeys,
  MAX_RANGE_DAYS,
} from '@/features/attendance/admin/api';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { useToday } from '@/hooks/use-today';
import { formatDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import type { ScanLog } from '@/types';
import {
  findSuspiciousUsers,
  SUSPICIOUS_CODES,
  SUSPICIOUS_THRESHOLD,
  type SuspiciousUser,
} from './suspicious';

type Filter = 'success' | 'errorCode' | 'userId' | 'dateFrom' | 'dateTo';

const LIST_CONFIG: ListParamsConfig<Filter> = {
  sortable: ['createdAt'],
  defaultSort: { id: 'createdAt', desc: true },
  filters: ['success', 'errorCode', 'userId', 'dateFrom', 'dateTo'],
};

/** Nilai `success` di URL: kosong = default "Gagal"; `all` = semua. */
const RESULT_OPTIONS = [
  { value: 'true', label: 'Berhasil' },
  { value: 'all', label: 'Semua hasil' },
];

/** Kode gagal yang dicatat scan log (subset kode error bisnis). */
const ERROR_CODES = [
  'OUTSIDE_GEOFENCE',
  'DEVICE_MISMATCH',
  'LOCATION_ACCURACY_LOW',
  'QR_EXPIRED',
  'QR_INVALID',
  'QR_ALREADY_USED',
  'KIOSK_INACTIVE',
  'CHECKIN_WINDOW_CLOSED',
  'CHECKOUT_TOO_SOON',
  'ALREADY_CHECKED_IN',
  'ALREADY_CHECKED_OUT',
  'NOT_WORKING_DAY',
  'HOLIDAY',
  'ON_LEAVE',
  'NO_SHIFT_ASSIGNED',
  'ACCOUNT_INACTIVE',
].map((code) => ({ value: code, label: code }));

const CODE_LABELS: Record<string, string> = {
  OUTSIDE_GEOFENCE: 'di luar area',
  DEVICE_MISMATCH: 'perangkat lain',
};

/** Halaman maksimal yang diambil per kode untuk deteksi pola (100 log/halaman). */
const SUSPICIOUS_MAX_PAGES = 5;

/** Semua kegagalan OUTSIDE_GEOFENCE/DEVICE_MISMATCH pada `date` (gabungan beberapa halaman). */
async function fetchSuspiciousLogs(date: string): Promise<ScanLog[]> {
  const perCode = await Promise.all(
    SUSPICIOUS_CODES.map(async (errorCode) => {
      const logs: ScanLog[] = [];
      for (let page = 1; page <= SUSPICIOUS_MAX_PAGES; page += 1) {
        const result = await attendanceAdminApi.scanLogs({
          page,
          limit: 100,
          success: 'false',
          errorCode,
          dateFrom: date,
          dateTo: date,
        });
        logs.push(...result.items);
        if (page >= result.meta.totalPages) break;
      }
      return logs;
    }),
  );
  return perCode.flat();
}

const column = createDataTableColumnHelper<ScanLog>();

/** `/admin/scan-logs`: semua percobaan scan (default yang gagal) + sorotan pola mencurigakan. */
export function ScanLogsView() {
  const today = useToday();
  const list = useListParams(LIST_CONFIG);
  const { success, dateFrom, dateTo } = list.params.filters;

  const query: Record<string, string | number> = Object.fromEntries(
    Object.entries(list.query).filter(([key]) => key !== 'success'),
  );
  if (success !== 'all') query.success = success === 'true' ? 'true' : 'false';

  const logs = useQuery({
    queryKey: attendanceAdminKeys.scanLogs(query),
    queryFn: () => attendanceAdminApi.scanLogs(query),
    placeholderData: keepPreviousData,
  });
  const suspicious = useQuery({
    queryKey: attendanceAdminKeys.suspicious(today ?? ''),
    queryFn: async () => findSuspiciousUsers(await fetchSuspiciousLogs(today ?? ''), today ?? ''),
    enabled: Boolean(today),
    refetchInterval: 60_000,
  });
  const flagged = suspicious.data;

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('createdAt', {
          header: 'Waktu',
          meta: { label: 'Waktu', cellClassName: 'whitespace-nowrap tabular-nums' },
          cell: ({ getValue }) => formatDateTime(getValue()),
        }),
        column.accessor((log) => log.user?.name ?? '', {
          id: 'user',
          header: 'Karyawan',
          enableSorting: false,
          enableHiding: false,
          meta: { label: 'Karyawan' },
          cell: ({ row }) => {
            const user = row.original.user;
            if (!user) return <span className="text-muted-foreground">Tidak dikenal</span>;
            const flag = flagged?.get(user.id);
            return (
              <div className="min-w-40 space-y-1">
                <p className="truncate font-medium">{user.name}</p>
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {user.employeeCode}
                  </span>
                  {flag ? <AttentionBadge user={flag} /> : null}
                </p>
              </div>
            );
          },
        }),
        column.accessor((log) => log.kiosk?.name ?? '', {
          id: 'kiosk',
          header: 'Kiosk',
          enableSorting: false,
          meta: { label: 'Kiosk', cellClassName: 'whitespace-nowrap' },
          cell: ({ row }) =>
            row.original.scanType === 'PERSONAL'
              ? 'QR personal'
              : (row.original.kiosk?.name ?? '—'),
        }),
        column.accessor('errorCode', {
          header: 'Hasil',
          enableSorting: false,
          meta: { label: 'Kode error' },
          cell: ({ row }) =>
            row.original.success ? (
              <Badge variant="outline" className="gap-1 border-success/40 text-success">
                <CheckCircle2Icon aria-hidden="true" />
                Berhasil
              </Badge>
            ) : (
              <Badge variant="destructive" className="font-mono text-[11px]">
                {row.original.errorCode ?? 'GAGAL'}
              </Badge>
            ),
        }),
        column.accessor('distance', {
          header: 'Jarak',
          enableSorting: false,
          meta: {
            label: 'Jarak',
            className: 'text-right',
            cellClassName: 'tabular-nums whitespace-nowrap',
          },
          cell: ({ getValue }) => {
            const value = getValue();
            return value != null ? `${Math.round(value).toLocaleString('id-ID')} m` : '—';
          },
        }),
        column.accessor('accuracy', {
          header: 'Akurasi',
          enableSorting: false,
          meta: {
            label: 'Akurasi',
            className: 'text-right',
            cellClassName: 'tabular-nums whitespace-nowrap',
          },
          cell: ({ getValue }) => {
            const value = getValue();
            return value != null ? `±${Math.round(value)} m` : '—';
          },
        }),
        column.accessor('deviceId', {
          header: 'Device ID',
          enableSorting: false,
          meta: { label: 'Device ID' },
          cell: ({ getValue }) => {
            const value = getValue();
            return value ? (
              <span className="font-mono text-xs" title={value}>
                {value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value}
              </span>
            ) : (
              '—'
            );
          },
        }),
        column.accessor('ipAddress', {
          header: 'IP',
          enableSorting: false,
          meta: { label: 'IP', cellClassName: 'font-mono text-xs' },
          cell: ({ getValue }) => getValue() ?? '—',
        }),
      ]),
    [flagged],
  );

  const flaggedUsers = flagged ? [...flagged.values()].sort((a, b) => b.total - a.total) : [];
  const filtersActive = Boolean(
    list.params.search || Object.values(list.params.filters).some(Boolean),
  );

  return (
    <div className="space-y-4">
      {flaggedUsers.length > 0 ? (
        <Alert className="border-warning/50 bg-warning/10" data-testid="suspicious-alert">
          <AlertTriangleIcon className="text-amber-700 dark:text-warning" aria-hidden="true" />
          <AlertTitle>Perlu perhatian hari ini</AlertTitle>
          <AlertDescription>
            <p>
              Karyawan dengan ≥ {SUSPICIOUS_THRESHOLD} scan gagal karena di luar area atau perangkat
              lain. Klik nama untuk melihat log-nya.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {flaggedUsers.map((user) => (
                <li key={user.userId}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-8 bg-card py-1 text-left"
                    onClick={() => {
                      list.setFilter('userId', user.userId);
                      list.setFilter('dateFrom', today);
                      list.setFilter('dateTo', today);
                      list.setFilter('success', null);
                    }}
                  >
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{describeCounts(user)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={logs.data?.items ?? []}
        rowCount={logs.data?.meta.total ?? 0}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        search={{
          value: list.params.search,
          onChange: list.setSearch,
          placeholder: 'Cari nama atau NIP…',
        }}
        getRowId={(log) => log.id}
        rowClassName={(log) =>
          log.user && flagged?.has(log.user.id) && !log.success ? 'bg-warning/5' : undefined
        }
        isLoading={logs.isPending}
        isFetching={logs.isFetching}
        error={logs.isError ? getErrorMessage(logs.error) : null}
        onRetry={() => void logs.refetch()}
        initialColumnVisibility={{ deviceId: true, ipAddress: true }}
        filters={
          <>
            <OptionSelect
              value={success}
              onChange={(value) => list.setFilter('success', value)}
              options={RESULT_OPTIONS}
              noneLabel="Gagal"
              className="w-full sm:w-36"
              aria-label="Filter hasil scan"
            />
            <OptionSelect
              value={list.params.filters.errorCode}
              onChange={(value) => list.setFilter('errorCode', value)}
              options={ERROR_CODES}
              noneLabel="Semua kode"
              className="w-full sm:w-52"
              aria-label="Filter kode error"
            />
            <DateRangePicker
              value={dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null}
              onChange={(next) => {
                list.setFilter('dateFrom', next?.from ?? null);
                list.setFilter('dateTo', next?.to ?? null);
              }}
              maxDate={today ?? undefined}
              maxDays={MAX_RANGE_DAYS}
              placeholder="Bulan ini"
              aria-label="Rentang tanggal log"
            />
            {list.params.filters.userId ? (
              <Badge variant="secondary" className="h-8 gap-1">
                Satu karyawan
                <button
                  type="button"
                  className="rounded-sm px-1 hover:bg-muted"
                  onClick={() => list.setFilter('userId', null)}
                  aria-label="Hapus filter karyawan"
                >
                  ×
                </button>
              </Badge>
            ) : null}
            {filtersActive ? (
              <Button variant="ghost" onClick={list.resetFilters}>
                Reset filter
              </Button>
            ) : null}
          </>
        }
        emptyState={filtersActive ? undefined : <EmptyLogs />}
      />
    </div>
  );
}

function describeCounts(user: SuspiciousUser): string {
  return SUSPICIOUS_CODES.filter((code) => user.byCode[code] > 0)
    .map((code) => `${user.byCode[code]}× ${CODE_LABELS[code]}`)
    .join(', ');
}

function AttentionBadge({ user }: { user: SuspiciousUser }) {
  return (
    <Badge
      className="gap-1 bg-warning text-warning-foreground"
      title={`${describeCounts(user)} hari ini`}
      data-testid="attention-badge"
    >
      <AlertTriangleIcon aria-hidden="true" />
      Perlu perhatian
    </Badge>
  );
}

function EmptyLogs() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <ScrollTextIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">Tidak ada scan gagal</p>
      <p className="text-sm text-muted-foreground">
        Belum ada percobaan scan gagal pada rentang ini.
      </p>
    </div>
  );
}
