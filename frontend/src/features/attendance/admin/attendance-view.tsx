'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, MoreHorizontalIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { initialsOf } from '@/components/layout/user-menu';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { OptionSelect } from '@/components/shared/option-select';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDepartmentOptions } from '@/features/master/hooks';
import { reportsApi } from '@/features/reports/api';
import { ExportMenu } from '@/features/reports/components/export-actions';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { useToday } from '@/hooks/use-today';
import { formatDateShort, formatMinutes, formatTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import type { AttendanceDetail, AttendanceListItem, AttendanceStatus } from '@/types';
import { attendanceAdminApi, attendanceAdminKeys, MAX_RANGE_DAYS } from './api';
import { AttendanceDetailSheet } from './attendance-detail-sheet';
import { ATTENDANCE_STATUSES, STATUS_LABELS } from './correction';
import { CorrectionDialog } from './correction-dialog';
import { ManualAttendanceDialog } from './manual-attendance-dialog';
import { MethodIcons } from './method-icons';

type Filter = 'dateFrom' | 'dateTo' | 'departmentId' | 'status';

const LIST_CONFIG: ListParamsConfig<Filter> = {
  sortable: ['date', 'checkInAt', 'lateMinutes', 'workMinutes', 'createdAt'],
  defaultSort: { id: 'date', desc: true },
  filters: ['dateFrom', 'dateTo', 'departmentId', 'status'],
};

const STATUS_OPTIONS = ATTENDANCE_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

const column = createDataTableColumnHelper<AttendanceListItem>();

/** `/admin/attendance`: absensi semua karyawan (default hari ini), detail, koreksi & manual. */
export function AttendanceView() {
  const today = useToday();
  const list = useListParams(LIST_CONFIG);
  const departments = useDepartmentOptions();
  const detailSheet = useDialogTarget<string>();
  const correction = useDialogTarget<AttendanceDetail>();
  const [manualOpen, setManualOpen] = useState(false);
  const { show: showDetail } = detailSheet;
  const { show: showCorrection } = correction;
  const queryClient = useQueryClient();

  // "Koreksi" dari menu baris: ambil detail (shiftSnapshot untuk preview) lalu buka dialog.
  const openCorrection = useCallback(
    async (id: string) => {
      try {
        showCorrection(
          await queryClient.fetchQuery({
            queryKey: attendanceAdminKeys.detail(id),
            queryFn: () => attendanceAdminApi.detail(id),
          }),
        );
      } catch (error) {
        toast.error('Gagal memuat data absensi', { description: getErrorMessage(error) });
      }
    },
    [queryClient, showCorrection],
  );

  const { dateFrom, dateTo } = list.params.filters;
  // Tanpa filter tanggal di URL → hari ini (sama dengan default backend untuk dateTo).
  const range = today
    ? { from: dateFrom ?? dateTo ?? today, to: dateTo ?? dateFrom ?? today }
    : null;
  const query = range ? { ...list.query, dateFrom: range.from, dateTo: range.to } : null;

  const attendance = useQuery({
    queryKey: attendanceAdminKeys.list(query ?? {}),
    queryFn: () => attendanceAdminApi.list(query ?? {}),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });

  const changeRange = (next: { from: string; to: string } | null) => {
    list.setFilter('dateFrom', next?.from ?? null);
    list.setFilter('dateTo', next?.to ?? null);
  };

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('date', {
          header: 'Tanggal',
          meta: { label: 'Tanggal', cellClassName: 'whitespace-nowrap tabular-nums' },
          cell: ({ getValue }) => formatDateShort(getValue()),
        }),
        column.accessor((row) => row.user.name, {
          id: 'employee',
          header: 'Karyawan',
          enableSorting: false,
          enableHiding: false,
          meta: { label: 'Karyawan' },
          cell: ({ row }) => {
            const item = row.original;
            return (
              <button
                type="button"
                onClick={() => showDetail(item.id)}
                className="flex min-w-44 items-center gap-3 rounded-md text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Lihat detail absensi ${item.user.name}`}
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initialsOf(item.user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.user.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {item.user.employeeCode}
                  </span>
                </span>
              </button>
            );
          },
        }),
        column.accessor((row) => row.user.department?.name ?? '—', {
          id: 'department',
          header: 'Departemen',
          enableSorting: false,
          meta: { label: 'Departemen', cellClassName: 'whitespace-nowrap' },
        }),
        column.accessor('checkInAt', {
          header: 'Masuk',
          meta: { label: 'Jam masuk', cellClassName: 'tabular-nums' },
          cell: ({ getValue }) => {
            const value = getValue();
            return value ? formatTime(value) : '—';
          },
        }),
        column.accessor('checkOutAt', {
          header: 'Pulang',
          enableSorting: false,
          meta: { label: 'Jam pulang', cellClassName: 'tabular-nums' },
          cell: ({ getValue }) => {
            const value = getValue();
            return value ? formatTime(value) : '—';
          },
        }),
        column.accessor('lateMinutes', {
          header: 'Terlambat',
          meta: {
            label: 'Terlambat (menit)',
            className: 'text-right',
            cellClassName: 'tabular-nums',
          },
          cell: ({ getValue }) => {
            const value = getValue();
            return value > 0 ? (
              <span className="font-medium text-amber-700 dark:text-amber-300">{value} m</span>
            ) : (
              <span className="text-muted-foreground">0</span>
            );
          },
        }),
        column.accessor('workMinutes', {
          header: 'Total kerja',
          meta: {
            label: 'Total kerja',
            className: 'text-right',
            cellClassName: 'whitespace-nowrap tabular-nums',
          },
          cell: ({ getValue }) => (getValue() > 0 ? formatMinutes(getValue()) : '—'),
        }),
        column.accessor('status', {
          header: 'Status',
          enableSorting: false,
          meta: { label: 'Status' },
          cell: ({ getValue }) => <StatusBadge status={getValue() as AttendanceStatus} />,
        }),
        column.display({
          id: 'method',
          header: 'Metode',
          meta: { label: 'Metode' },
          cell: ({ row }) => (
            <MethodIcons
              checkIn={row.original.checkInMethod}
              checkOut={row.original.checkOutMethod}
            />
          ),
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Aksi</span>,
          enableHiding: false,
          meta: { className: 'w-12 text-right' },
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Aksi untuk ${row.original.user.name}`}
                >
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => showDetail(row.original.id)}>
                  <EyeIcon aria-hidden="true" />
                  Lihat detail
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void openCorrection(row.original.id)}>
                  <PencilIcon aria-hidden="true" />
                  Koreksi
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [showDetail, openCorrection],
  );

  const filtersActive = Boolean(
    list.params.search || Object.values(list.params.filters).some(Boolean),
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={attendance.data?.items ?? []}
        rowCount={attendance.data?.meta.total ?? 0}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        search={{
          value: list.params.search,
          onChange: list.setSearch,
          placeholder: 'Cari nama atau NIP…',
        }}
        getRowId={(row) => row.id}
        onRowClick={(row) => showDetail(row.id)}
        isLoading={attendance.isPending}
        isFetching={attendance.isFetching}
        error={attendance.isError ? getErrorMessage(attendance.error) : null}
        onRetry={() => void attendance.refetch()}
        filters={
          <>
            <DateRangePicker
              value={range}
              onChange={changeRange}
              maxDate={today ?? undefined}
              maxDays={MAX_RANGE_DAYS}
              clearable={Boolean(dateFrom || dateTo)}
              aria-label="Rentang tanggal absensi"
            />
            <OptionSelect
              value={list.params.filters.departmentId}
              onChange={(value) => list.setFilter('departmentId', value)}
              options={departments.data}
              loading={departments.isPending}
              noneLabel="Semua departemen"
              className="w-full sm:w-48"
              aria-label="Filter departemen"
            />
            <OptionSelect
              value={list.params.filters.status}
              onChange={(value) => list.setFilter('status', value)}
              options={STATUS_OPTIONS}
              noneLabel="Semua status"
              className="w-full sm:w-36"
              aria-label="Filter status"
            />
            {filtersActive ? (
              <Button variant="ghost" onClick={list.resetFilters}>
                Reset filter
              </Button>
            ) : null}
          </>
        }
        actions={
          <>
            <ExportMenu
              label="Export Hari Ini"
              disabled={!today}
              onExport={(format) => reportsApi.downloadDaily(today ?? '', format)}
            />
            <Button onClick={() => setManualOpen(true)}>
              <PlusIcon aria-hidden="true" />
              Tambah Manual
            </Button>
          </>
        }
      />

      <AttendanceDetailSheet
        attendanceId={detailSheet.target}
        open={detailSheet.open}
        onOpenChange={detailSheet.onOpenChange}
        onCorrect={correction.show}
      />
      <CorrectionDialog
        detail={correction.target}
        open={correction.open}
        onOpenChange={correction.onOpenChange}
      />
      <ManualAttendanceDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        defaultDate={range?.to}
      />
    </>
  );
}
