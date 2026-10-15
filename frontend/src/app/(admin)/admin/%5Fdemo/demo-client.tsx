'use client';

import type { PaginationState, SortingState } from '@tanstack/react-table';
import {
  CalendarCheck2Icon,
  ClockAlertIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  UserXIcon,
  UsersIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { type DateRangeValue, DateRangePicker } from '@/components/shared/date-range-picker';
import { MonthPicker } from '@/components/shared/month-picker';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import {
  ATTENDANCE_STATUS_META,
  LEAVE_STATUS_META,
  StatusBadge,
} from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToday } from '@/hooks/use-today';
import type { AttendanceStatus, LeaveStatus } from '@/types';
import {
  DEMO_DEPARTMENTS,
  DEMO_EMPLOYEES,
  type DemoEmployee,
  type DemoSortField,
  queryDemoEmployees,
} from './demo-data';

const column = createDataTableColumnHelper<DemoEmployee>();
const ALL_DEPARTMENTS = '__all__';

export function DemoClient() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue | null>(null);
  const today = useToday();
  const [month, setMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failing, setFailing] = useState(false);
  const [toDelete, setToDelete] = useState<DemoEmployee | null>(null);

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('employeeCode', {
          header: 'Kode',
          meta: { label: 'Kode', className: 'w-24', cellClassName: 'font-mono text-xs' },
        }),
        column.accessor('name', {
          header: 'Nama',
          meta: { label: 'Nama' },
          cell: ({ row }) => (
            <div className="min-w-40">
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          ),
        }),
        column.accessor('department', {
          header: 'Departemen',
          meta: { label: 'Departemen', className: 'whitespace-nowrap' },
        }),
        column.accessor('status', {
          header: 'Kehadiran',
          enableSorting: false,
          meta: { label: 'Kehadiran' },
          cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        }),
        column.accessor('checkIn', {
          header: 'Jam masuk',
          meta: { label: 'Jam masuk', className: 'tabular-nums' },
          cell: ({ row }) =>
            row.original.checkIn ? (
              <span>
                {row.original.checkIn}
                {row.original.lateMinutes > 0 ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (+{row.original.lateMinutes} mnt)
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        }),
        column.accessor('leaveStatus', {
          header: 'Pengajuan',
          enableSorting: false,
          meta: { label: 'Pengajuan' },
          cell: ({ getValue }) => <StatusBadge kind="leave" status={getValue()} />,
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
                  aria-label={`Aksi untuk ${row.original.name}`}
                >
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row.original)}>
                  <Trash2Icon aria-hidden="true" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [],
  );

  const sort = sorting[0];
  const result = queryDemoEmployees({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search,
    department,
    sortBy: (sort?.id as DemoSortField | undefined) ?? null,
    sortOrder: sort?.desc ? 'desc' : 'asc',
  });

  const count = (status: AttendanceStatus) =>
    DEMO_EMPLOYEES.filter((row) => row.status === status).length;

  return (
    <>
      <PageHeader
        title="Demo Komponen"
        description="Halaman sementara FE-02 untuk meninjau design system — dihapus di FE-08."
        actions={
          <>
            <Button variant="outline" className="min-h-10">
              <DownloadIcon aria-hidden="true" />
              Export
            </Button>
            <Button className="min-h-10">
              <PlusIcon aria-hidden="true" />
              Tambah Karyawan
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total karyawan"
          value={DEMO_EMPLOYEES.length}
          icon={UsersIcon}
          tone="neutral"
        />
        <StatCard
          label="Hadir"
          value={count('PRESENT')}
          icon={CalendarCheck2Icon}
          tone="primary"
          hint="Tepat waktu hari ini"
        />
        <StatCard
          label="Terlambat"
          value={count('LATE')}
          icon={ClockAlertIcon}
          tone="warning"
          loading={loading}
        />
        <StatCard label="Alpa" value={count('ABSENT')} icon={UserXIcon} tone="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status &amp; pemilih tanggal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ATTENDANCE_STATUS_META) as AttendanceStatus[]).map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LEAVE_STATUS_META) as LeaveStatus[]).map((status) => (
              <StatusBadge key={status} kind="leave" status={status} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {today ? (
              <>
                <DateRangePicker value={range} onChange={setRange} maxDate={today} />
                <MonthPicker
                  value={month ?? today.slice(0, 7)}
                  onChange={setMonth}
                  maxMonth={today.slice(0, 7)}
                />
              </>
            ) : (
              <>
                <Skeleton className="h-10 w-56" />
                <Skeleton className="h-10 w-64" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Switch id="demo-loading" checked={loading} onCheckedChange={setLoading} />
          <Label htmlFor="demo-loading">Simulasi loading</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="demo-error" checked={failing} onCheckedChange={setFailing} />
          <Label htmlFor="demo-error">Simulasi error</Label>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={result.items}
        rowCount={result.total}
        getRowId={(row) => row.id}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={(updater) => {
          setSorting(updater);
          setPagination((state) => ({ ...state, pageIndex: 0 }));
        }}
        search={{ value: search, onChange: setSearch, placeholder: 'Cari nama / kode…' }}
        filters={
          <Select
            value={department ?? ALL_DEPARTMENTS}
            onValueChange={(value) => {
              setDepartment(value === ALL_DEPARTMENTS ? null : value);
              setPagination((state) => ({ ...state, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="h-10 w-48" aria-label="Filter departemen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DEPARTMENTS}>Semua departemen</SelectItem>
              {DEMO_DEPARTMENTS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        isLoading={loading}
        error={failing ? 'Server tidak dapat dihubungi (simulasi).' : null}
        onRetry={() => setFailing(false)}
        initialColumnVisibility={{ leaveStatus: false }}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Ganti password</CardTitle>
          <CardDescription>
            Komponen FE-03 untuk halaman profil (FE-06). Menggunakan API sungguhan — setelah
            berhasil, semua sesi keluar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Hapus karyawan?"
        description={
          toDelete
            ? `${toDelete.name} (${toDelete.employeeCode}) akan dinonaktifkan. Data absensi tetap tersimpan.`
            : undefined
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 800));
          toast.success('Karyawan dihapus (simulasi)');
        }}
      />
    </>
  );
}
