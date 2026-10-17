'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileClockIcon,
  MessageSquareTextIcon,
  XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { initialsOf } from '@/components/layout/user-menu';
import { SearchInput } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { OptionSelect } from '@/components/shared/option-select';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardApi, dashboardKeys } from '@/features/dashboard/api';
import type { ListQuery } from '@/features/master/api';
import { useDepartmentOptions } from '@/features/master/hooks';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { formatDateShort, formatDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import type { LeaveRequest, LeaveStatus } from '@/types';
import { LEAVE_TYPE_META, LEAVE_TYPES } from '../meta';
import { leaveAdminApi, leaveAdminKeys } from './api';
import { AttachmentButton } from './attachment-preview';
import { ReviewDialog, type ReviewTarget } from './review-dialog';
import { useLeaveReview } from './use-leave-review';

type Filter = 'status' | 'type' | 'departmentId' | 'dateFrom' | 'dateTo';

const LIST_CONFIG: ListParamsConfig<Filter> = {
  sortable: ['createdAt', 'startDate', 'totalDays'],
  defaultSort: { id: 'createdAt', desc: true },
  filters: ['status', 'type', 'departmentId', 'dateFrom', 'dateTo'],
};

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
const TABS: { value: Tab; label: string }[] = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'ALL', label: 'Semua' },
];
const TAB_VALUES = new Set<string>(TABS.map((tab) => tab.value));

const TYPE_OPTIONS = LEAVE_TYPES.map((type) => ({
  value: type,
  label: LEAVE_TYPE_META[type].label,
}));

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Terbaru diajukan' },
  { value: 'createdAt:asc', label: 'Terlama diajukan' },
  { value: 'startDate:asc', label: 'Mulai paling awal' },
  { value: 'totalDays:desc', label: 'Hari terbanyak' },
];

/** `/admin/leave-requests`: approval izin/cuti (tab status, setujui massal, optimistic). */
export function LeaveRequestsView() {
  const list = useListParams(LIST_CONFIG);
  const departments = useDepartmentOptions();
  const review = useLeaveReview();
  const dialog = useDialogTarget<ReviewTarget>();
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());

  const rawStatus = list.params.filters.status;
  const tab: Tab = rawStatus && TAB_VALUES.has(rawStatus) ? (rawStatus as Tab) : 'PENDING';
  // Tab = filter status; "Semua" → tanpa filter (termasuk Dibatalkan).
  const query: ListQuery = Object.fromEntries(
    Object.entries(list.query).filter(([key]) => key !== 'status'),
  );
  if (tab !== 'ALL') query.status = tab;

  const leaves = useQuery({
    queryKey: leaveAdminKeys.list(query),
    queryFn: () => leaveAdminApi.list(query),
    placeholderData: keepPreviousData,
  });
  // Sama dengan pratinjau dashboard & badge menu (satu request, key bersama).
  const pending = useQuery({
    queryKey: dashboardKeys.pendingLeaves(),
    queryFn: dashboardApi.pendingLeaves,
    refetchInterval: 60_000,
  });
  const pendingCount = pending.data?.meta.total ?? 0;

  const items = leaves.data?.items ?? [];
  const selectable = items.filter((item) => item.status === 'PENDING');
  // Pilihan hanya berlaku untuk item PENDING yang masih tampil (setelah approve/ganti halaman).
  const selected = useMemo(
    () => selectable.filter((item) => selection.has(item.id)).map((item) => item.id),
    [selectable, selection],
  );
  const allSelected = selectable.length > 0 && selected.length === selectable.length;

  const toggle = (id: string, checked: boolean) =>
    setSelection((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const reviewOne = (leave: LeaveRequest, action: ReviewTarget['action']) =>
    dialog.show({ action, ids: [leave.id], subject: leave.user.name });

  const meta = leaves.data?.meta;
  const filtersActive = Boolean(
    list.params.search ||
    list.params.filters.type ||
    list.params.filters.departmentId ||
    list.params.filters.dateFrom,
  );
  const sortValue = `${list.params.sortBy}:${list.params.sortOrder}`;
  const range =
    list.params.filters.dateFrom && list.params.filters.dateTo
      ? { from: list.params.filters.dateFrom, to: list.params.filters.dateTo }
      : null;

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setSelection(new Set());
          list.setFilter('status', value === 'PENDING' ? null : value);
        }}
      >
        <TabsList className="h-10">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="gap-2 px-3">
              {item.label}
              {item.value === 'PENDING' && pendingCount > 0 ? (
                <span
                  className="rounded-full bg-warning px-1.5 text-xs font-semibold text-warning-foreground tabular-nums"
                  aria-label={`${pendingCount} menunggu`}
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput
          search={{
            value: list.params.search,
            onChange: list.setSearch,
            placeholder: 'Cari nama atau NIP…',
          }}
        />
        <OptionSelect
          value={list.params.filters.type}
          onChange={(value) => list.setFilter('type', value)}
          options={TYPE_OPTIONS}
          noneLabel="Semua tipe"
          className="w-full lg:w-40"
          aria-label="Filter tipe"
        />
        <OptionSelect
          value={list.params.filters.departmentId}
          onChange={(value) => list.setFilter('departmentId', value)}
          options={departments.data}
          loading={departments.isPending}
          noneLabel="Semua departemen"
          className="w-full lg:w-48"
          aria-label="Filter departemen"
        />
        <DateRangePicker
          value={range}
          onChange={(next) => {
            list.setFilter('dateFrom', next?.from ?? null);
            list.setFilter('dateTo', next?.to ?? null);
          }}
          placeholder="Rentang izin"
          aria-label="Filter rentang tanggal izin"
        />
        <OptionSelect
          value={SORT_OPTIONS.some((option) => option.value === sortValue) ? sortValue : null}
          onChange={(value) => {
            const [id, order] = (value ?? 'createdAt:desc').split(':');
            list.onSortingChange([{ id: id ?? 'createdAt', desc: order === 'desc' }]);
          }}
          options={SORT_OPTIONS}
          noneLabel="Urutan bawaan"
          className="w-full lg:w-44"
          aria-label="Urutkan"
        />
        {filtersActive ? (
          <Button
            variant="ghost"
            onClick={() => {
              list.resetFilters();
              if (tab !== 'PENDING') list.setFilter('status', tab);
            }}
          >
            Reset filter
          </Button>
        ) : null}
      </div>

      {selectable.length > 0 ? (
        <div
          className={cn(
            'sticky top-14 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 px-4 py-2 shadow-xs backdrop-blur',
            selected.length > 0 && 'border-primary/40',
          )}
        >
          <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allSelected ? true : selected.length > 0 ? 'indeterminate' : false}
              onCheckedChange={(checked) =>
                setSelection(checked ? new Set(selectable.map((item) => item.id)) : new Set())
              }
              aria-label="Pilih semua pengajuan menunggu di halaman ini"
            />
            {selected.length > 0 ? `${selected.length} dipilih` : 'Pilih semua'}
          </label>
          {selected.length > 0 ? (
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setSelection(new Set())}>
                Batal pilih
              </Button>
              <Button
                onClick={() =>
                  dialog.show({
                    action: 'approve',
                    ids: selected,
                    subject: `${selected.length} karyawan`,
                  })
                }
                disabled={review.isPending}
              >
                <CheckIcon aria-hidden="true" />
                Setujui {selected.length}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {leaves.isPending ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : leaves.isError ? (
        <ErrorState
          className="rounded-xl border"
          message={getErrorMessage(leaves.error)}
          onRetry={() => void leaves.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          className="rounded-xl border bg-card"
          icon={FileClockIcon}
          title={
            tab === 'PENDING' && !filtersActive
              ? 'Tidak ada pengajuan menunggu'
              : 'Tidak ada pengajuan'
          }
          description={
            tab === 'PENDING' && !filtersActive
              ? 'Semua pengajuan izin & cuti sudah diproses.'
              : 'Coba ubah filter atau tab.'
          }
        />
      ) : (
        <ul
          className={cn(
            'grid gap-3 xl:grid-cols-2',
            leaves.isFetching && 'opacity-70 transition-opacity',
          )}
          aria-busy={leaves.isFetching}
        >
          {items.map((leave) => (
            <li key={leave.id}>
              <AdminLeaveCard
                leave={leave}
                selected={selection.has(leave.id)}
                onSelect={(checked) => toggle(leave.id, checked)}
                onApprove={() => reviewOne(leave, 'approve')}
                onReject={() => reviewOne(leave, 'reject')}
              />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.total > 0 ? (
        <nav
          className="flex items-center justify-between gap-3 text-sm"
          aria-label="Halaman pengajuan"
        >
          <p className="text-muted-foreground" aria-live="polite">
            {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.total, meta.page * meta.limit)} dari{' '}
            {meta.total} pengajuan
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              disabled={meta.page <= 1}
              onClick={() =>
                list.onPaginationChange((state) => ({ ...state, pageIndex: state.pageIndex - 1 }))
              }
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <span className="px-2 tabular-nums">
              {meta.page} / {Math.max(1, meta.totalPages)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              disabled={meta.page >= meta.totalPages}
              onClick={() =>
                list.onPaginationChange((state) => ({ ...state, pageIndex: state.pageIndex + 1 }))
              }
              aria-label="Halaman berikutnya"
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
        </nav>
      ) : null}

      <ReviewDialog
        target={dialog.target}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        onSubmit={(target, note) => {
          review.mutate({ ids: target.ids, action: target.action, note: note || undefined });
          setSelection((current) => {
            const next = new Set(current);
            target.ids.forEach((id) => next.delete(id));
            return next;
          });
        }}
      />
    </div>
  );
}

/** Alasan lebih panjang dari ini dipotong (bisa dibuka). */
const REASON_PREVIEW_CHARS = 160;

function AdminLeaveCard({
  leave,
  selected,
  onSelect,
  onApprove,
  onReject,
}: {
  leave: LeaveRequest;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = LEAVE_TYPE_META[leave.type];
  const Icon = meta.icon;
  const isPending = leave.status === 'PENDING';
  const long = leave.reason.length > REASON_PREVIEW_CHARS || leave.reason.split('\n').length > 3;
  const sameDay = leave.startDate === leave.endDate;

  return (
    <article
      className={cn(
        'flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors',
        selected && 'border-primary/50 bg-primary/5',
      )}
      data-status={leave.status}
      data-testid="admin-leave-card"
    >
      <div className="flex items-start gap-3">
        {isPending ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            className="mt-2.5"
            aria-label={`Pilih pengajuan ${leave.user.name}`}
          />
        ) : null}
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initialsOf(leave.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{leave.user.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{leave.user.employeeCode}</span>
            {leave.user.department ? ` · ${leave.user.department.name}` : ''}
          </p>
        </div>
        <StatusBadge kind="leave" status={leave.status as LeaveStatus} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium',
            meta.tone,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {meta.label}
        </span>
        <span className="tabular-nums">
          {sameDay
            ? formatDateShort(leave.startDate)
            : `${formatDateShort(leave.startDate)} – ${formatDateShort(leave.endDate)}`}
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {leave.totalDays} hari kerja
        </Badge>
      </div>

      <div className="text-sm">
        <p
          id={`reason-${leave.id}`}
          className={cn('break-words whitespace-pre-line', long && !expanded && 'line-clamp-3')}
        >
          {leave.reason}
        </p>
        {long ? (
          <button
            type="button"
            className="mt-1 text-xs font-medium text-primary hover:underline"
            aria-expanded={expanded}
            aria-controls={`reason-${leave.id}`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Sembunyikan' : 'Selengkapnya'}
          </button>
        ) : null}
      </div>

      {leave.reviewNote || leave.reviewedBy ? (
        <p className="flex gap-2 rounded-xl bg-muted/70 px-3 py-2 text-sm">
          <MessageSquareTextIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="text-muted-foreground">
              {leave.reviewedBy?.name ?? 'Admin'}
              {leave.reviewedAt ? ` · ${formatDateTime(leave.reviewedAt)}` : ''}
            </span>
            {leave.reviewNote ? (
              <span className="block break-words">{leave.reviewNote}</span>
            ) : null}
          </span>
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <span className="mr-auto text-xs text-muted-foreground">
          Diajukan {formatDateTime(leave.createdAt)}
        </span>
        {leave.hasAttachment ? <AttachmentButton leave={leave} /> : null}
        {isPending ? (
          <>
            <Button variant="outline" size="sm" className="min-h-9" onClick={onReject}>
              <XIcon aria-hidden="true" />
              Tolak
            </Button>
            <Button size="sm" className="min-h-9" onClick={onApprove}>
              <CheckIcon aria-hidden="true" />
              Setujui
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
