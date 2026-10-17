'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, ShieldAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { OptionSelect } from '@/components/shared/option-select';
import { UserCombobox } from '@/components/shared/user-combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { formatDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { AuditAction, AuditLog } from '@/types';
import { auditLogsApi, auditLogKeys } from './api';
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS, auditDetails } from './diff';

type Filter = 'action' | 'actorId' | 'entity' | 'dateFrom' | 'dateTo';

const LIST_CONFIG: ListParamsConfig<Filter> = {
  sortable: ['createdAt'],
  defaultSort: { id: 'createdAt', desc: true },
  filters: ['action', 'actorId', 'entity', 'dateFrom', 'dateTo'],
};

const ACTION_OPTIONS = AUDIT_ACTIONS.map((action) => ({
  value: action,
  label: AUDIT_ACTION_LABELS[action],
}));

const ENTITY_LABELS: Record<string, string> = {
  User: 'Pengguna',
  Attendance: 'Absensi',
  LeaveRequest: 'Izin/Cuti',
  Kiosk: 'Kiosk',
  Setting: 'Pengaturan',
  RefreshToken: 'Sesi',
};
const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }));

/** Warna lencana aksi: keamanan (merah), perubahan data (biru), lainnya netral. */
const ACTION_TONE: Partial<Record<AuditAction, string>> = {
  LOGIN_FAILED: 'bg-destructive/10 text-destructive',
  REFRESH_TOKEN_REUSE_DETECTED: 'bg-destructive/10 text-destructive',
  USER_DEACTIVATED: 'bg-destructive/10 text-destructive',
  ATTENDANCE_CORRECTED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  ATTENDANCE_MANUAL_CREATED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  SETTING_UPDATED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  USER_UPDATED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  LEAVE_APPROVED: 'bg-success/10 text-success',
  LEAVE_REJECTED: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
};

const column = createDataTableColumnHelper<AuditLog>();

/** `/admin/audit-logs` (SUPER_ADMIN): jejak aksi penting + diff before/after yang mudah dibaca. */
export function AuditLogsView() {
  const role = useAuthStore((state) => state.user?.role);
  if (role !== 'SUPER_ADMIN') {
    return (
      <Alert variant="destructive">
        <ShieldAlertIcon aria-hidden="true" />
        <AlertDescription>Halaman ini khusus Super Admin.</AlertDescription>
      </Alert>
    );
  }
  return <AuditLogsTable />;
}

function AuditLogsTable() {
  const list = useListParams(LIST_CONFIG);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const { dateFrom, dateTo } = list.params.filters;

  const logs = useQuery({
    queryKey: auditLogKeys.list(list.query),
    queryFn: () => auditLogsApi.list(list.query),
    placeholderData: keepPreviousData,
  });

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns = useMemo(
    () =>
      column.columns([
        column.display({
          id: 'expand',
          header: () => <span className="sr-only">Rincian</span>,
          enableHiding: false,
          meta: { className: 'w-10' },
          cell: ({ row }) => {
            const open = expanded.has(row.original.id);
            return (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-expanded={open}
                aria-label={open ? 'Sembunyikan rincian' : 'Tampilkan rincian'}
                onClick={() => toggle(row.original.id)}
              >
                <ChevronRightIcon
                  className={cn('transition-transform', open && 'rotate-90')}
                  aria-hidden="true"
                />
              </Button>
            );
          },
        }),
        column.accessor('createdAt', {
          header: 'Waktu',
          meta: { label: 'Waktu', cellClassName: 'whitespace-nowrap tabular-nums' },
          cell: ({ getValue }) => formatDateTime(getValue()),
        }),
        column.accessor('action', {
          header: 'Aksi',
          enableSorting: false,
          meta: { label: 'Aksi' },
          cell: ({ getValue }) => (
            <Badge
              variant="secondary"
              className={cn('whitespace-nowrap', ACTION_TONE[getValue()])}
              title={getValue()}
            >
              {AUDIT_ACTION_LABELS[getValue()] ?? getValue()}
            </Badge>
          ),
        }),
        column.accessor((log) => log.actor?.name ?? '', {
          id: 'actor',
          header: 'Aktor',
          enableSorting: false,
          meta: { label: 'Aktor' },
          cell: ({ row }) => {
            const actor = row.original.actor;
            return actor ? (
              <span className="block min-w-36">
                <span className="block truncate font-medium">{actor.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{actor.email}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Sistem / tidak dikenal</span>
            );
          },
        }),
        column.accessor('entity', {
          header: 'Entitas',
          enableSorting: false,
          meta: { label: 'Entitas' },
          cell: ({ row }) => (
            <span className="block">
              <span className="block">
                {ENTITY_LABELS[row.original.entity] ?? row.original.entity}
              </span>
              {row.original.entityId ? (
                <span
                  className="block font-mono text-xs text-muted-foreground"
                  title={row.original.entityId}
                >
                  {row.original.entityId.slice(0, 8)}…
                </span>
              ) : null}
            </span>
          ),
        }),
        column.accessor('ipAddress', {
          header: 'IP',
          enableSorting: false,
          meta: { label: 'IP', cellClassName: 'font-mono text-xs' },
          cell: ({ getValue }) => getValue() ?? '—',
        }),
      ]),
    [expanded],
  );

  const filtersActive = Boolean(
    list.params.search || Object.values(list.params.filters).some(Boolean),
  );

  return (
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
        placeholder: 'Cari nama/email aktor…',
      }}
      getRowId={(log) => log.id}
      onRowClick={(log) => toggle(log.id)}
      expandedRowIds={expanded}
      renderRowDetail={(log) => <AuditDetailPanel log={log} />}
      isLoading={logs.isPending}
      isFetching={logs.isFetching}
      error={logs.isError ? getErrorMessage(logs.error) : null}
      onRetry={() => void logs.refetch()}
      filters={
        <>
          <OptionSelect
            value={list.params.filters.action}
            onChange={(value) => list.setFilter('action', value)}
            options={ACTION_OPTIONS}
            noneLabel="Semua aksi"
            className="w-full sm:w-52"
            aria-label="Filter aksi"
          />
          <UserCombobox
            value={list.params.filters.actorId}
            onChange={(userId) => list.setFilter('actorId', userId)}
            placeholder="Semua aktor"
            clearable
            className="w-full sm:w-60"
            aria-label="Filter aktor"
          />
          <OptionSelect
            value={list.params.filters.entity}
            onChange={(value) => list.setFilter('entity', value)}
            options={ENTITY_OPTIONS}
            noneLabel="Semua entitas"
            className="w-full sm:w-40"
            aria-label="Filter entitas"
          />
          <DateRangePicker
            value={dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null}
            onChange={(next) => {
              list.setFilter('dateFrom', next?.from ?? null);
              list.setFilter('dateTo', next?.to ?? null);
            }}
            placeholder="Semua tanggal"
            aria-label="Rentang tanggal audit"
          />
          {filtersActive ? (
            <Button variant="ghost" onClick={list.resetFilters}>
              Reset filter
            </Button>
          ) : null}
        </>
      }
    />
  );
}

function AuditDetailPanel({ log }: { log: AuditLog }) {
  const details = auditDetails(log.metadata);
  const empty = details.diff.length === 0 && details.info.length === 0 && !details.reason;
  return (
    <div className="space-y-3 px-4 py-3 text-sm" data-testid="audit-detail">
      {details.reason ? (
        <p>
          <span className="text-muted-foreground">Alasan: </span>
          <span className="font-medium break-words">{details.reason}</span>
        </p>
      ) : null}
      {details.diff.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Perubahan data</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Field
                </th>
                {details.hasBefore ? (
                  <th scope="col" className="px-3 py-2 font-medium">
                    Sebelum
                  </th>
                ) : null}
                <th scope="col" className="px-3 py-2 font-medium">
                  {details.hasBefore ? 'Sesudah' : 'Nilai'}
                </th>
              </tr>
            </thead>
            <tbody>
              {details.diff.map((row) => (
                <tr
                  key={row.key}
                  className={cn('border-t', !row.changed && 'text-muted-foreground')}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {row.label}
                  </th>
                  {details.hasBefore ? (
                    <td
                      className={cn(
                        'px-3 py-1.5 tabular-nums',
                        row.changed &&
                          'bg-destructive/5 text-destructive line-through decoration-destructive/40',
                      )}
                    >
                      {row.before}
                    </td>
                  ) : null}
                  <td
                    className={cn(
                      'px-3 py-1.5 tabular-nums',
                      row.changed && details.hasBefore && 'bg-success/10 font-medium text-success',
                    )}
                  >
                    {row.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {details.info.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {details.info.map((item) => (
            <div key={item.key} className="grid grid-cols-[9rem_1fr] gap-2">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="break-all">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {empty ? <p className="text-muted-foreground">Tidak ada metadata.</p> : null}
      {log.userAgent ? (
        <p className="text-xs break-all text-muted-foreground">
          <span className="font-medium">User agent:</span> {log.userAgent}
        </p>
      ) : null}
    </div>
  );
}
