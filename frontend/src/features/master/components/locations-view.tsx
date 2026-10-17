'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CrosshairIcon, Loader2Icon, MapPinIcon, PlusIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FormDialog } from '@/components/shared/form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { getErrorMessage } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { getCurrentPosition, GeoError } from '@/lib/geolocation';
import { useToastMutation } from '@/lib/mutation';
import type { Location, LocationInput } from '@/types';
import { locationsApi, masterKeys } from '../api';
import { RowActions } from './row-actions';

// Leaflet butuh `window` → hanya dirender di browser (tanpa SSR/prerender).
const LocationMap = dynamic(() => import('./location-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const LIST_CONFIG: ListParamsConfig = {
  sortable: ['name', 'createdAt'],
  defaultSort: { id: 'name', desc: false },
};

/** Pusat awal peta untuk lokasi baru (Monas, Jakarta). */
const DEFAULT_CENTER = { latitude: -6.1753924, longitude: 106.8271528 };
const RADIUS_MIN = 10;
const RADIUS_MAX = 5000;

const coordinate = (label: string, min: number, max: number) =>
  z.coerce
    .number<string | number>({ error: `${label} harus angka` })
    .min(min, { error: `${label} minimal ${min}` })
    .max(max, { error: `${label} maksimal ${max}` })
    .refine(
      (value) =>
        Number.isInteger(Math.round(value * 1e7)) &&
        Math.abs(value * 1e7 - Math.round(value * 1e7)) < 1e-6,
      {
        error: `${label} maksimal 7 angka desimal`,
      },
    );

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Nama lokasi minimal 2 karakter' })
    .max(100, { error: 'Nama lokasi maksimal 100 karakter' }),
  address: z.string().trim().max(255, { error: 'Alamat maksimal 255 karakter' }),
  latitude: coordinate('Latitude', -90, 90),
  longitude: coordinate('Longitude', -180, 180),
  radiusMeters: z.coerce
    .number<string | number>({ error: 'Radius harus angka' })
    .int({ error: 'Radius harus bilangan bulat (meter)' })
    .min(RADIUS_MIN, { error: `Radius minimal ${RADIUS_MIN} meter` })
    .max(RADIUS_MAX, { error: `Radius maksimal ${RADIUS_MAX} meter` }),
  isActive: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const toForm = (location: Location | null): FormInput => ({
  name: location?.name ?? '',
  address: location?.address ?? '',
  latitude: location?.latitude ?? DEFAULT_CENTER.latitude,
  longitude: location?.longitude ?? DEFAULT_CENTER.longitude,
  radiusMeters: location?.radiusMeters ?? 100,
  isActive: location?.isActive ?? true,
});

const column = createDataTableColumnHelper<Location>();

/** `/admin/locations`: lokasi kantor + radius geofence (peta interaktif). */
export function LocationsView() {
  const list = useListParams(LIST_CONFIG);
  const editing = useDialogTarget<Location>();
  const deleting = useDialogTarget<Location>();
  const { show: showEditing } = editing;
  const { show: showDeleting } = deleting;

  const locations = useQuery({
    queryKey: masterKeys.locationList(list.query),
    queryFn: () => locationsApi.list(list.query),
    placeholderData: keepPreviousData,
  });
  const remove = useToastMutation({
    mutationFn: (id: string) => locationsApi.remove(id),
    invalidate: [masterKeys.locations],
    success: () => 'Lokasi dihapus',
    error: 'Gagal menghapus lokasi',
  });

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Nama',
          meta: { label: 'Nama' },
          cell: ({ row }) => (
            <div className="min-w-48">
              <p className="font-medium">{row.original.name}</p>
              {row.original.address ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">{row.original.address}</p>
              ) : null}
            </div>
          ),
        }),
        column.display({
          id: 'coordinate',
          header: 'Koordinat',
          meta: { label: 'Koordinat', cellClassName: 'font-mono text-xs whitespace-nowrap' },
          cell: ({ row }) => (
            <a
              href={`https://www.openstreetmap.org/?mlat=${row.original.latitude}&mlon=${row.original.longitude}#map=17/${row.original.latitude}/${row.original.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {row.original.latitude.toFixed(5)}, {row.original.longitude.toFixed(5)}
            </a>
          ),
        }),
        column.accessor('radiusMeters', {
          header: 'Radius',
          enableSorting: false,
          meta: { label: 'Radius', cellClassName: 'tabular-nums whitespace-nowrap' },
          cell: ({ getValue }) => `${getValue().toLocaleString('id-ID')} m`,
        }),
        column.accessor('kioskCount', {
          header: 'Kiosk',
          enableSorting: false,
          meta: { label: 'Kiosk', className: 'text-right', cellClassName: 'tabular-nums' },
        }),
        column.accessor('userCount', {
          header: 'Karyawan',
          enableSorting: false,
          meta: { label: 'Karyawan', className: 'text-right', cellClassName: 'tabular-nums' },
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
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Aksi</span>,
          enableHiding: false,
          meta: { className: 'w-12 text-right' },
          cell: ({ row }) => (
            <RowActions
              label={row.original.name}
              onEdit={() => showEditing(row.original)}
              onDelete={() => showDeleting(row.original)}
              deleteDisabledReason={
                row.original.kioskCount > 0 || row.original.userCount > 0
                  ? 'masih dipakai'
                  : undefined
              }
            />
          ),
        }),
      ]),
    [showEditing, showDeleting],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={locations.data?.items ?? []}
        rowCount={locations.data?.meta.total ?? 0}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        search={{
          value: list.params.search,
          onChange: list.setSearch,
          placeholder: 'Cari nama lokasi…',
        }}
        getRowId={(row) => row.id}
        isLoading={locations.isPending}
        isFetching={locations.isFetching}
        error={locations.isError ? getErrorMessage(locations.error) : null}
        onRetry={() => void locations.refetch()}
        actions={
          <Button onClick={() => showEditing(null)}>
            <PlusIcon aria-hidden="true" />
            Tambah
          </Button>
        }
        emptyState={
          list.params.search ? undefined : (
            <EmptyState
              icon={MapPinIcon}
              title="Belum ada lokasi"
              description="Tambahkan lokasi kantor & radius geofence."
            />
          )
        }
      />
      <LocationDialog
        location={editing.target}
        open={editing.open}
        onOpenChange={editing.onOpenChange}
      />
      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.onOpenChange}
        title={`Hapus lokasi ${deleting.target?.name ?? ''}?`}
        description="Lokasi yang masih dipakai kiosk atau karyawan tidak dapat dihapus — nonaktifkan saja."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => (deleting.target ? remove.mutateAsync(deleting.target.id) : undefined)}
      />
    </>
  );
}

const SERVER_FIELDS = [
  'name',
  'address',
  'latitude',
  'longitude',
  'radiusMeters',
  'isActive',
] as const;

function LocationDialog({
  location,
  open,
  onOpenChange,
}: {
  location: Location | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toForm(null),
  });
  useEffect(() => {
    if (open) form.reset(toForm(location));
  }, [open, location, form]);
  const [locating, setLocating] = useState(false);
  const values = useWatch({ control: form.control });
  const lat = Number(values.latitude);
  const lng = Number(values.longitude);
  const radius = Number(values.radiusMeters);
  const mapReady =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const save = useToastMutation({
    mutationFn: (input: LocationInput) =>
      location ? locationsApi.update(location.id, input) : locationsApi.create(input),
    invalidate: [masterKeys.locations],
    success: (saved) => (location ? `${saved.name} diperbarui` : `${saved.name} ditambahkan`),
    error: false,
  });
  const submit = form.handleSubmit(async (value) => {
    try {
      await save.mutateAsync({ ...value, address: value.address || null });
      onOpenChange(false);
    } catch (error) {
      if (!applyServerFieldErrors(error, form.setError, SERVER_FIELDS)) {
        toast.error('Gagal menyimpan lokasi', { description: getErrorMessage(error) });
      }
    }
  });

  const setPoint = (latitude: number, longitude: number) => {
    form.setValue('latitude', latitude, { shouldDirty: true, shouldValidate: true });
    form.setValue('longitude', longitude, { shouldDirty: true, shouldValidate: true });
  };

  const pickMyLocation = async () => {
    setLocating(true);
    try {
      const position = await getCurrentPosition();
      setPoint(
        Math.round(position.latitude * 1e7) / 1e7,
        Math.round(position.longitude * 1e7) / 1e7,
      );
      toast.success('Titik diatur ke lokasi Anda', {
        description: `Akurasi ±${Math.round(position.accuracy)} m`,
      });
    } catch (error) {
      toast.error('Lokasi tidak didapat', {
        description: error instanceof GeoError ? error.message : getErrorMessage(error),
      });
    } finally {
      setLocating(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={location ? 'Ubah lokasi' : 'Tambah lokasi'}
      description="Klik peta untuk menentukan titik kantor; lingkaran menunjukkan radius absensi (geofence)."
      formId="location-form"
      pending={save.isPending}
      className="sm:max-w-3xl"
    >
      <form
        id="location-form"
        onSubmit={submit}
        noValidate
        className="grid gap-5 md:grid-cols-[1fr_1.1fr]"
      >
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="location-name">Nama lokasi</FieldLabel>
                <Input
                  {...field}
                  id="location-name"
                  placeholder="Kantor Pusat"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="address"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="location-address">Alamat (opsional)</FieldLabel>
                <Input {...field} id="location-address" aria-invalid={fieldState.invalid} />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['latitude', 'Latitude'],
                ['longitude', 'Longitude'],
              ] as const
            ).map(([name, label]) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`location-${name}`}>{label}</FieldLabel>
                    <Input
                      id={`location-${name}`}
                      inputMode="decimal"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={String(field.value ?? '')}
                      onChange={(event) => field.onChange(event.target.value)}
                      className="font-mono text-sm"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void pickMyLocation()}
            disabled={locating}
          >
            {locating ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <CrosshairIcon aria-hidden="true" />
            )}
            Gunakan lokasi saya saat ini
          </Button>
          <Controller
            name="radiusMeters"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="location-radius">Radius geofence</FieldLabel>
                  <div className="flex items-center gap-1">
                    <Input
                      id="location-radius"
                      type="number"
                      inputMode="numeric"
                      min={RADIUS_MIN}
                      max={RADIUS_MAX}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={String(field.value ?? '')}
                      onChange={(event) => field.onChange(event.target.value)}
                      className="h-8 w-24 text-right tabular-nums"
                      aria-invalid={fieldState.invalid}
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
                <Slider
                  min={RADIUS_MIN}
                  max={1000}
                  step={10}
                  value={[Math.min(1000, Number(field.value) || RADIUS_MIN)]}
                  onValueChange={([next]) => next !== undefined && field.onChange(next)}
                  aria-label="Radius geofence (meter)"
                />
                <FieldDescription>
                  Geser untuk 10–1000 m; ketik angka hingga 5000 m.
                </FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="isActive"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch
                  id="location-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel htmlFor="location-active">Lokasi aktif</FieldLabel>
              </Field>
            )}
          />
        </FieldGroup>
        <div
          className="h-80 overflow-hidden rounded-xl border md:h-full md:min-h-96"
          data-testid="location-map"
        >
          {open && mapReady ? (
            <LocationMap
              latitude={lat}
              longitude={lng}
              radiusMeters={
                Number.isFinite(radius) ? Math.min(Math.max(radius, RADIUS_MIN), RADIUS_MAX) : 100
              }
              onPick={setPoint}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Isi latitude & longitude yang valid untuk menampilkan peta.
            </div>
          )}
        </div>
      </form>
    </FormDialog>
  );
}
