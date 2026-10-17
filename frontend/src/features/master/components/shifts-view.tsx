'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Clock3Icon, PlusIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FormDialog } from '@/components/shared/form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { getErrorMessage } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { useToastMutation } from '@/lib/mutation';
import { parseWorkDays } from '@/lib/working-days';
import type { Shift, ShiftInput } from '@/types';
import { masterKeys, shiftsApi } from '../api';
import {
  checkInOpensAt,
  describeWorkDays,
  isTimeAfter,
  shiftPreview,
  toWorkDaysString,
  WEEKDAYS,
} from '../shift-utils';
import { RowActions } from './row-actions';

const LIST_CONFIG: ListParamsConfig = {
  sortable: ['name', 'startTime', 'createdAt'],
  defaultSort: { id: 'name', desc: false },
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (label: string, max: number) =>
  z.coerce
    .number<string | number>({ error: `${label} harus angka` })
    .int({ error: `${label} harus bilangan bulat` })
    .min(0, { error: `${label} minimal 0 menit` })
    .max(max, { error: `${label} maksimal ${max} menit` });

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { error: 'Nama shift minimal 2 karakter' })
      .max(50, { error: 'Nama shift maksimal 50 karakter' }),
    startTime: z.string().regex(TIME, { error: 'Jam masuk harus HH:mm' }),
    endTime: z.string().regex(TIME, { error: 'Jam pulang harus HH:mm' }),
    lateToleranceMinutes: minutes('Toleransi terlambat', 120),
    checkInOpenMinutes: minutes('Waktu buka absen', 240),
    workDays: z.array(z.number()).min(1, { error: 'Pilih minimal satu hari kerja' }),
    isActive: z.boolean(),
  })
  // Aturan lintas-field sama dengan backend (shift-rules.ts).
  .refine((value) => isTimeAfter(value.endTime, value.startTime), {
    path: ['endTime'],
    error: 'Jam pulang harus setelah jam masuk (shift lintas tengah malam tidak didukung)',
  })
  .refine((value) => checkInOpensAt(value.startTime, Number(value.checkInOpenMinutes)) !== null, {
    path: ['checkInOpenMinutes'],
    error: 'Waktu buka absen tidak boleh dimulai sebelum pukul 00:00',
  });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const toForm = (shift: Shift | null): FormInput => ({
  name: shift?.name ?? '',
  startTime: shift?.startTime ?? '08:00',
  endTime: shift?.endTime ?? '17:00',
  lateToleranceMinutes: shift?.lateToleranceMinutes ?? 15,
  checkInOpenMinutes: shift?.checkInOpenMinutes ?? 60,
  workDays: shift ? parseWorkDays(shift.workDays) : [1, 2, 3, 4, 5],
  isActive: shift?.isActive ?? true,
});

const column = createDataTableColumnHelper<Shift>();

/** `/admin/shifts`: CRUD shift kerja. */
export function ShiftsView() {
  const list = useListParams(LIST_CONFIG);
  const editing = useDialogTarget<Shift>();
  const deleting = useDialogTarget<Shift>();
  const { show: showEditing } = editing;
  const { show: showDeleting } = deleting;

  const shifts = useQuery({
    queryKey: masterKeys.shiftList(list.query),
    queryFn: () => shiftsApi.list(list.query),
    placeholderData: keepPreviousData,
  });
  const remove = useToastMutation({
    mutationFn: (id: string) => shiftsApi.remove(id),
    invalidate: [masterKeys.shifts],
    success: () => 'Shift dihapus',
    error: 'Gagal menghapus shift',
  });

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Nama',
          meta: { label: 'Nama', cellClassName: 'font-medium' },
        }),
        column.accessor('startTime', {
          header: 'Jam kerja',
          meta: { label: 'Jam kerja', cellClassName: 'tabular-nums whitespace-nowrap' },
          cell: ({ row }) => `${row.original.startTime}–${row.original.endTime}`,
        }),
        column.accessor('workDays', {
          header: 'Hari kerja',
          enableSorting: false,
          meta: { label: 'Hari kerja' },
          cell: ({ getValue }) => describeWorkDays(parseWorkDays(getValue())),
        }),
        column.accessor('lateToleranceMinutes', {
          header: 'Toleransi',
          enableSorting: false,
          meta: { label: 'Toleransi', cellClassName: 'tabular-nums whitespace-nowrap' },
          cell: ({ getValue }) => `${getValue()} menit`,
        }),
        column.accessor('checkInOpenMinutes', {
          header: 'Absen dibuka',
          enableSorting: false,
          meta: { label: 'Absen dibuka', cellClassName: 'tabular-nums' },
          cell: ({ row }) =>
            checkInOpensAt(row.original.startTime, row.original.checkInOpenMinutes) ?? '—',
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
              deleteDisabledReason={row.original.userCount > 0 ? 'masih dipakai' : undefined}
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
        data={shifts.data?.items ?? []}
        rowCount={shifts.data?.meta.total ?? 0}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        search={{
          value: list.params.search,
          onChange: list.setSearch,
          placeholder: 'Cari nama shift…',
        }}
        getRowId={(row) => row.id}
        isLoading={shifts.isPending}
        isFetching={shifts.isFetching}
        error={shifts.isError ? getErrorMessage(shifts.error) : null}
        onRetry={() => void shifts.refetch()}
        actions={
          <Button onClick={() => showEditing(null)}>
            <PlusIcon aria-hidden="true" />
            Tambah
          </Button>
        }
        emptyState={
          list.params.search ? undefined : (
            <EmptyState
              icon={Clock3Icon}
              title="Belum ada shift"
              description="Tambahkan shift kerja pertama."
            />
          )
        }
      />
      <ShiftDialog shift={editing.target} open={editing.open} onOpenChange={editing.onOpenChange} />
      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.onOpenChange}
        title={`Hapus shift ${deleting.target?.name ?? ''}?`}
        description="Shift yang masih dipakai karyawan tidak dapat dihapus — nonaktifkan saja."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => (deleting.target ? remove.mutateAsync(deleting.target.id) : undefined)}
      />
    </>
  );
}

const SERVER_FIELDS = [
  'name',
  'startTime',
  'endTime',
  'lateToleranceMinutes',
  'checkInOpenMinutes',
  'workDays',
  'isActive',
] as const;

function ShiftDialog({
  shift,
  open,
  onOpenChange,
}: {
  shift: Shift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toForm(null),
  });
  useEffect(() => {
    if (open) form.reset(toForm(shift));
  }, [open, shift, form]);
  const values = useWatch({ control: form.control });

  const save = useToastMutation({
    mutationFn: (input: ShiftInput) =>
      shift ? shiftsApi.update(shift.id, input) : shiftsApi.create(input),
    invalidate: [masterKeys.shifts],
    success: (saved) => (shift ? `${saved.name} diperbarui` : `${saved.name} ditambahkan`),
    error: false,
  });

  const submit = form.handleSubmit(async (value) => {
    try {
      await save.mutateAsync({ ...value, workDays: toWorkDaysString(value.workDays) });
      onOpenChange(false);
    } catch (error) {
      if (!applyServerFieldErrors(error, form.setError, SERVER_FIELDS)) {
        toast.error('Gagal menyimpan shift', { description: getErrorMessage(error) });
      }
    }
  });

  const preview =
    values.startTime && values.endTime
      ? shiftPreview({
          startTime: values.startTime,
          endTime: values.endTime,
          lateToleranceMinutes: Number(values.lateToleranceMinutes ?? 0),
          checkInOpenMinutes: Number(values.checkInOpenMinutes ?? 0),
          workDays: (values.workDays ?? []).filter((day): day is number => typeof day === 'number'),
        })
      : '';

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={shift ? 'Ubah shift' : 'Tambah shift'}
      formId="shift-form"
      pending={save.isPending}
    >
      <form id="shift-form" onSubmit={submit} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="shift-name">Nama shift</FieldLabel>
                <Input
                  {...field}
                  id="shift-name"
                  placeholder="Reguler"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ['startTime', 'Jam masuk'],
                ['endTime', 'Jam pulang'],
              ] as const
            ).map(([name, label]) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`shift-${name}`}>{label}</FieldLabel>
                    <Input
                      {...field}
                      id={`shift-${name}`}
                      type="time"
                      step={60}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ))}
            {(
              [
                ['lateToleranceMinutes', 'Toleransi terlambat (menit)', 120],
                ['checkInOpenMinutes', 'Absen dibuka sebelum masuk (menit)', 240],
              ] as const
            ).map(([name, label, max]) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`shift-${name}`}>{label}</FieldLabel>
                    <Input
                      id={`shift-${name}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={max}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={String(field.value ?? '')}
                      onChange={(event) => field.onChange(event.target.value)}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ))}
          </div>
          <Controller
            name="workDays"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel id="shift-workdays-label">Hari kerja</FieldLabel>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={(field.value ?? []).map(String)}
                  onValueChange={(next) => field.onChange(next.map(Number))}
                  aria-labelledby="shift-workdays-label"
                  className="flex w-full flex-wrap"
                  spacing={1}
                >
                  {WEEKDAYS.map((day) => (
                    <ToggleGroupItem
                      key={day.value}
                      value={String(day.value)}
                      aria-label={day.long}
                      className="min-h-10 min-w-12 flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {day.short}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="isActive"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="shift-active" checked={field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor="shift-active">
                  Shift aktif (dapat dipilih untuk karyawan)
                </FieldLabel>
              </Field>
            )}
          />
          <FieldDescription
            data-testid="shift-preview"
            className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground"
          >
            {preview}
          </FieldDescription>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
