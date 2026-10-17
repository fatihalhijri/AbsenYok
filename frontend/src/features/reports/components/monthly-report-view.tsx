'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  FileSpreadsheetIcon,
  PercentIcon,
  TimerIcon,
  UsersIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { MonthPicker } from '@/components/shared/month-picker';
import { OptionSelect } from '@/components/shared/option-select';
import { StatCard } from '@/components/shared/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDepartmentOptions } from '@/features/master/hooks';
import { useToday } from '@/hooks/use-today';
import { formatMinutes, formatMonth } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import type { MonthlyReportRow } from '@/types';
import {
  departmentRates,
  type ReportSort,
  type ReportSortKey,
  reportTotals,
  sortReportRows,
} from '../aggregate';
import { reportKeys, reportsApi } from '../api';
import { DepartmentRateChart } from './department-rate-chart';
import { ExportButtons } from './export-actions';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

interface Column {
  key: ReportSortKey;
  label: string;
  numeric?: boolean;
  render?: (row: MonthlyReportRow) => string;
}

/** Kolom sesuai kontrak `/reports/monthly` (urutan sama dengan file export). */
const COLUMNS: Column[] = [
  { key: 'employeeCode', label: 'NIP' },
  { key: 'name', label: 'Nama' },
  { key: 'department', label: 'Departemen', render: (row) => row.department ?? '—' },
  { key: 'workingDays', label: 'Hari kerja', numeric: true },
  { key: 'present', label: 'Hadir', numeric: true },
  { key: 'late', label: 'Terlambat', numeric: true },
  { key: 'totalLateMinutes', label: 'Menit terlambat', numeric: true },
  { key: 'absent', label: 'Alpa', numeric: true },
  { key: 'sick', label: 'Sakit', numeric: true },
  { key: 'permit', label: 'Izin', numeric: true },
  { key: 'leave', label: 'Cuti', numeric: true },
  {
    key: 'totalWorkMinutes',
    label: 'Total kerja',
    numeric: true,
    render: (row) => formatMinutes(row.totalWorkMinutes),
  },
  {
    key: 'attendanceRate',
    label: 'Kehadiran',
    numeric: true,
    render: (row) => `${row.attendanceRate.toLocaleString('id-ID')}%`,
  },
];

/** `/admin/reports`: rekap bulanan per karyawan + export Excel/PDF + kehadiran per departemen. */
export function MonthlyReportView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = useToday();
  const currentMonth = today?.slice(0, 7) ?? null;
  const monthParam = searchParams.get('month');
  const month = monthParam && MONTH_PATTERN.test(monthParam) ? monthParam : currentMonth;
  const departmentId = searchParams.get('departmentId');
  const departments = useDepartmentOptions();
  const [sort, setSort] = useState<ReportSort>({ key: 'name', desc: false });

  const setParam = (key: 'month' | 'departmentId', value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && !(key === 'month' && value === currentMonth)) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const report = useQuery({
    queryKey: reportKeys.monthly(month ?? '', departmentId),
    queryFn: () => reportsApi.monthly(month ?? '', departmentId),
    enabled: month !== null,
  });

  const rows = useMemo(() => report.data?.items ?? [], [report.data]);
  const sorted = useMemo(() => sortReportRows(rows, sort), [rows, sort]);
  const totals = useMemo(() => reportTotals(rows), [rows]);
  const byDepartment = useMemo(() => departmentRates(rows), [rows]);

  const toggleSort = (key: ReportSortKey, numeric?: boolean) =>
    setSort((current) =>
      current.key === key ? { key, desc: !current.desc } : { key, desc: Boolean(numeric) },
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {month ? (
            <MonthPicker
              value={month}
              onChange={(value) => setParam('month', value)}
              maxMonth={currentMonth ?? undefined}
            />
          ) : (
            <Skeleton className="h-10 w-48" />
          )}
          <OptionSelect
            value={departmentId}
            onChange={(value) => setParam('departmentId', value)}
            options={departments.data}
            loading={departments.isPending}
            noneLabel="Semua departemen"
            className="w-full sm:w-52"
            aria-label="Filter departemen"
          />
        </div>
        <ExportButtons
          disabled={!month || report.isPending}
          onExport={(format) => reportsApi.downloadMonthly(month ?? '', format, departmentId)}
        />
      </div>

      {report.isError ? (
        <ErrorState
          className="rounded-xl border"
          message={getErrorMessage(report.error)}
          onRetry={() => void report.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Karyawan"
              value={totals.employees}
              icon={UsersIcon}
              loading={report.isPending}
              hint={report.data?.departmentName ?? 'Semua departemen'}
            />
            <StatCard
              label="Kehadiran gabungan"
              value={`${totals.attendanceRate.toLocaleString('id-ID')}%`}
              icon={PercentIcon}
              tone="primary"
              loading={report.isPending}
              hint={month ? formatMonth(month) : undefined}
            />
            <StatCard
              label="Total keterlambatan"
              value={formatMinutes(totals.totalLateMinutes)}
              icon={TimerIcon}
              tone="warning"
              loading={report.isPending}
              hint={`${totals.late} kali terlambat`}
            />
          </div>

          {byDepartment.length > 1 ? <DepartmentRateChart data={byDepartment} /> : null}

          {report.isPending ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <EmptyState
              className="rounded-xl border bg-card"
              icon={FileSpreadsheetIcon}
              title="Belum ada data"
              description="Tidak ada karyawan aktif pada bulan/departemen ini."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <Table data-testid="monthly-report-table">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    {COLUMNS.map((column) => {
                      const active = sort.key === column.key;
                      return (
                        <TableHead
                          key={column.key}
                          className={cn('h-11', column.numeric && 'text-right')}
                          aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(column.key, column.numeric)}
                            className={cn(
                              '-mx-2 inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                              column.numeric && 'flex-row-reverse',
                            )}
                          >
                            {column.label}
                            {active ? (
                              sort.desc ? (
                                <ArrowDownIcon className="size-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowUpIcon className="size-3.5" aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDownIcon className="size-3.5 opacity-40" aria-hidden="true" />
                            )}
                          </button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((row) => (
                    <TableRow key={row.userId}>
                      {COLUMNS.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(
                            'h-11',
                            column.numeric && 'text-right tabular-nums',
                            column.key === 'employeeCode' && 'font-mono text-xs',
                            column.key === 'name' && 'font-medium',
                          )}
                        >
                          {column.render ? column.render(row) : String(row[column.key] ?? '—')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-semibold">
                    <TableCell colSpan={3}>Total ({totals.employees} karyawan)</TableCell>
                    {COLUMNS.slice(3).map((column) => (
                      <TableCell key={column.key} className="text-right tabular-nums">
                        {column.key === 'attendanceRate'
                          ? `${totals.attendanceRate.toLocaleString('id-ID')}%`
                          : column.key === 'totalWorkMinutes'
                            ? formatMinutes(totals.totalWorkMinutes)
                            : totals[column.key as keyof typeof totals].toLocaleString('id-ID')}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
