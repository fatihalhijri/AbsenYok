'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ExternalLinkIcon,
  MonitorSmartphoneIcon,
  PlusIcon,
  PowerIcon,
  RefreshCcwIcon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FormDialog } from '@/components/shared/form-dialog';
import { OptionSelect } from '@/components/shared/option-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RowActions } from '@/features/master/components/row-actions';
import { useLocationOptions } from '@/features/master/hooks';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { useNow } from '@/hooks/use-now';
import { formatDateTime, formatRelative } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { useToastMutation } from '@/lib/mutation';
import { cn } from '@/lib/utils';
import type { Kiosk } from '@/types';
import { kioskApi, kioskKeys } from '../api';

type Filter = 'locationId' | 'isActive';
const LIST_CONFIG: ListParamsConfig<Filter> = {
  sortable: ['name', 'createdAt', 'lastSeenAt'],
  defaultSort: { id: 'name', desc: false },
  filters: ['locationId', 'isActive'],
};

/** Kiosk dianggap mati bila tidak memuat QR > 5 menit (layar kiosk memuat QR tiap interval). */
export const KIOSK_STALE_MS = 5 * 60_000;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Nama kiosk minimal 2 karakter' })
    .max(100, { error: 'Nama kiosk maksimal 100 karakter' }),
  locationId: z.string({ error: 'Pilih lokasi' }).min(1, { error: 'Pilih lokasi' }),
  qrIntervalSeconds: z.coerce
    .number<string | number>({ error: 'Interval harus angka' })
    .int({ error: 'Interval QR harus bilangan bulat (detik)' })
    .min(10, { error: 'Interval QR minimal 10 detik' })
    .max(300, { error: 'Interval QR maksimal 300 detik' }),
  isActive: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const column = createDataTableColumnHelper<Kiosk>();

/** "Terakhir aktif" relatif; merah bila lebih dari 5 menit (diperbarui tiap 30 dtk). */
function LastSeen({ value }: { value: string | null | undefined }) {
  const now = useNow(30_000);
  if (!value) return <span className="text-muted-foreground">Belum pernah</span>;
  const stale = now !== null && now - Date.parse(value) > KIOSK_STALE_MS;
  return (
    <time
      dateTime={value}
      title={formatDateTime(value)}
      data-stale={stale || undefined}
      className={cn('whitespace-nowrap', stale ? 'font-medium text-destructive' : 'text-success')}
    >
      {now === null ? formatDateTime(value) : formatRelative(value, now)}
    </time>
  );
}

/** `/admin/kiosks`: kelola kiosk + buka layar kiosk + rotasi secret. */
export function KioskList() {
  const list = useListParams(LIST_CONFIG);
  const locations = useLocationOptions();
  const editing = useDialogTarget<Kiosk>();
  const rotating = useDialogTarget<Kiosk>();
  const deactivating = useDialogTarget<Kiosk>();
  const { show: showEditing } = editing;
  const { show: showRotating } = rotating;
  const { show: showDeactivating } = deactivating;

  const kiosks = useQuery({
    queryKey: kioskKeys.list(list.query),
    queryFn: () => kioskApi.list(list.query),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000, // "terakhir aktif" tetap segar
  });
  const rotate = useToastMutation({
    mutationFn: (id: string) => kioskApi.rotateSecret(id),
    invalidate: [kioskKeys.all],
    success: (kiosk) => `Secret ${kiosk.name} dirotasi — QR lama tidak berlaku lagi`,
    error: 'Gagal merotasi secret',
  });
  const toggle = useToastMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      kioskApi.update(id, { isActive }),
    invalidate: [kioskKeys.all],
    success: (kiosk) => `${kiosk.name} ${kiosk.isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
    error: 'Gagal mengubah status kiosk',
  });

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Nama',
          meta: { label: 'Nama', cellClassName: 'font-medium' },
        }),
        column.accessor((kiosk) => kiosk.location.name, {
          id: 'location',
          header: 'Lokasi',
          enableSorting: false,
          meta: { label: 'Lokasi' },
        }),
        column.accessor('qrIntervalSeconds', {
          header: 'Interval QR',
          enableSorting: false,
          meta: { label: 'Interval QR', cellClassName: 'tabular-nums whitespace-nowrap' },
          cell: ({ getValue }) => `${getValue()} detik`,
        }),
        column.accessor('isActive', {
          header: 'Status',
          enableSorting: false,
          meta: { label: 'Status' },
          cell: ({ getValue }) => (
            <Badge variant={getValue() ? 'outline' : 'secondary'}>
              {getValue() ? 'Aktif' : 'Nonaktif'}
            </Badge>
          ),
        }),
        column.accessor('lastSeenAt', {
          header: 'Terakhir aktif',
          meta: { label: 'Terakhir aktif' },
          cell: ({ getValue }) => <LastSeen value={getValue()} />,
        }),
        column.display({
          id: 'open',
          header: () => <span className="sr-only">Layar</span>,
          enableHiding: false,
          meta: { className: 'w-44 text-right' },
          cell: ({ row }) => (
            <Button asChild variant="outline" size="sm">
              <a href={`/kiosk/${row.original.id}`} target="_blank" rel="noopener">
                <ExternalLinkIcon aria-hidden="true" />
                Buka Layar Kiosk
              </a>
            </Button>
          ),
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Aksi</span>,
          enableHiding: false,
          meta: { className: 'w-12 text-right' },
          cell: ({ row }) => {
            const kiosk = row.original;
            return (
              <RowActions label={kiosk.name} onEdit={() => showEditing(kiosk)}>
                <DropdownMenuItem onSelect={() => showRotating(kiosk)}>
                  <RefreshCcwIcon aria-hidden="true" />
                  Rotasi secret
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    kiosk.isActive
                      ? showDeactivating(kiosk)
                      : toggle.mutate({ id: kiosk.id, isActive: true })
                  }
                >
                  <PowerIcon aria-hidden="true" />
                  {kiosk.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </DropdownMenuItem>
              </RowActions>
            );
          },
        }),
      ]),
    [toggle, showEditing, showRotating, showDeactivating],
  );

  const filtersActive = Boolean(
    list.params.search || Object.values(list.params.filters).some(Boolean),
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={kiosks.data?.items ?? []}
        rowCount={kiosks.data?.meta.total ?? 0}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        search={{
          value: list.params.search,
          onChange: list.setSearch,
          placeholder: 'Cari nama kiosk…',
        }}
        getRowId={(row) => row.id}
        isLoading={kiosks.isPending}
        isFetching={kiosks.isFetching}
        error={kiosks.isError ? getErrorMessage(kiosks.error) : null}
        onRetry={() => void kiosks.refetch()}
        filters={
          <>
            <OptionSelect
              value={list.params.filters.locationId}
              onChange={(value) => list.setFilter('locationId', value)}
              options={locations.data}
              loading={locations.isPending}
              noneLabel="Semua lokasi"
              className="w-full sm:w-48"
              aria-label="Filter lokasi"
            />
            <OptionSelect
              value={list.params.filters.isActive}
              onChange={(value) => list.setFilter('isActive', value)}
              options={[
                { value: 'true', label: 'Aktif' },
                { value: 'false', label: 'Nonaktif' },
              ]}
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
          <Button onClick={() => showEditing(null)}>
            <PlusIcon aria-hidden="true" />
            Tambah
          </Button>
        }
        emptyState={
          filtersActive ? undefined : (
            <EmptyState
              icon={MonitorSmartphoneIcon}
              title="Belum ada kiosk"
              description="Tambahkan kiosk untuk layar QR di pintu masuk."
            />
          )
        }
      />
      <KioskDialog kiosk={editing.target} open={editing.open} onOpenChange={editing.onOpenChange} />
      <ConfirmDialog
        open={rotating.open}
        onOpenChange={rotating.onOpenChange}
        title={`Rotasi secret ${rotating.target?.name ?? ''}?`}
        description="QR yang sedang tampil akan langsung tidak berlaku. Layar kiosk otomatis menampilkan QR baru pada pembaruan berikutnya."
        confirmLabel="Rotasi secret"
        destructive
        onConfirm={() => (rotating.target ? rotate.mutateAsync(rotating.target.id) : undefined)}
      />
      <ConfirmDialog
        open={deactivating.open}
        onOpenChange={deactivating.onOpenChange}
        title={`Nonaktifkan ${deactivating.target?.name ?? ''}?`}
        description="Layar kiosk akan menampilkan 'Kiosk tidak tersedia' dan QR-nya tidak dapat dipakai absen."
        confirmLabel="Nonaktifkan"
        destructive
        onConfirm={() =>
          deactivating.target
            ? toggle.mutateAsync({ id: deactivating.target.id, isActive: false })
            : undefined
        }
      />
    </>
  );
}

const SERVER_FIELDS = ['name', 'locationId', 'qrIntervalSeconds', 'isActive'] as const;

function KioskDialog({
  kiosk,
  open,
  onOpenChange,
}: {
  kiosk: Kiosk | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locations = useLocationOptions();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', locationId: '', qrIntervalSeconds: 30, isActive: true },
  });
  useEffect(() => {
    if (open) {
      form.reset({
        name: kiosk?.name ?? '',
        locationId: kiosk?.location.id ?? '',
        qrIntervalSeconds: kiosk?.qrIntervalSeconds ?? 30,
        isActive: kiosk?.isActive ?? true,
      });
    }
  }, [open, kiosk, form]);

  const save = useToastMutation({
    mutationFn: (values: FormOutput) =>
      kiosk
        ? kioskApi.update(kiosk.id, values)
        : kioskApi.create({
            name: values.name,
            locationId: values.locationId,
            qrIntervalSeconds: values.qrIntervalSeconds,
          }),
    invalidate: [kioskKeys.all],
    success: (saved) => (kiosk ? `${saved.name} diperbarui` : `${saved.name} ditambahkan`),
    error: false,
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onOpenChange(false);
    } catch (error) {
      if (!applyServerFieldErrors(error, form.setError, SERVER_FIELDS)) {
        toast.error('Gagal menyimpan kiosk', { description: getErrorMessage(error) });
      }
    }
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={kiosk ? 'Ubah kiosk' : 'Tambah kiosk'}
      formId="kiosk-form"
      pending={save.isPending}
    >
      <form id="kiosk-form" onSubmit={submit} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="kiosk-name">Nama kiosk</FieldLabel>
                <Input
                  {...field}
                  id="kiosk-name"
                  placeholder="Lobi Utama"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="locationId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="kiosk-location">Lokasi</FieldLabel>
                <OptionSelect
                  id="kiosk-location"
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? '')}
                  options={locations.data}
                  loading={locations.isPending}
                  noneLabel="Pilih lokasi"
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>Geofence scan memakai lokasi ini.</FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="qrIntervalSeconds"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="kiosk-interval">Interval QR (detik)</FieldLabel>
                <Input
                  id="kiosk-interval"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={300}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={String(field.value ?? '')}
                  onChange={(event) => field.onChange(event.target.value)}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  10–300 detik. Makin pendek makin aman (default 30).
                </FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          {kiosk ? (
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch
                    id="kiosk-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <FieldLabel htmlFor="kiosk-active">Kiosk aktif</FieldLabel>
                </Field>
              )}
            />
          ) : null}
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
