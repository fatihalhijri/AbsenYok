'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2Icon, PlusIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FormDialog } from '@/components/shared/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { formatDateShort, toDateString } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { useToastMutation } from '@/lib/mutation';
import type { Department } from '@/types';
import { departmentsApi, masterKeys } from '../api';
import { RowActions } from './row-actions';

const LIST_CONFIG: ListParamsConfig = {
  sortable: ['code', 'name', 'createdAt'],
  defaultSort: { id: 'name', desc: false },
};

const schema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z.string().regex(/^[A-Z0-9_-]{2,20}$/, {
        error: 'Kode 2–20 karakter: huruf, angka, garis bawah, atau tanda hubung',
      }),
    ),
  name: z
    .string()
    .trim()
    .min(2, { error: 'Nama minimal 2 karakter' })
    .max(100, { error: 'Nama maksimal 100 karakter' }),
});
type FormValues = z.input<typeof schema>;

const column = createDataTableColumnHelper<Department>();

/** `/admin/departments`: CRUD departemen. */
export function DepartmentsView() {
  const list = useListParams(LIST_CONFIG);
  const editing = useDialogTarget<Department>();
  const deleting = useDialogTarget<Department>();
  const { show: showEditing } = editing;
  const { show: showDeleting } = deleting;

  const departments = useQuery({
    queryKey: masterKeys.departmentList(list.query),
    queryFn: () => departmentsApi.list(list.query),
    placeholderData: keepPreviousData,
  });
  const remove = useToastMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    invalidate: [masterKeys.departments],
    success: () => 'Departemen dihapus',
    error: 'Gagal menghapus departemen',
  });

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('code', {
          header: 'Kode',
          meta: { label: 'Kode', className: 'w-32', cellClassName: 'font-mono text-xs' },
        }),
        column.accessor('name', {
          header: 'Nama',
          meta: { label: 'Nama', cellClassName: 'font-medium' },
        }),
        column.accessor('userCount', {
          header: 'Karyawan',
          enableSorting: false,
          meta: { label: 'Karyawan', className: 'text-right', cellClassName: 'tabular-nums' },
        }),
        column.accessor('createdAt', {
          header: 'Dibuat',
          meta: { label: 'Dibuat', cellClassName: 'whitespace-nowrap text-muted-foreground' },
          cell: ({ getValue }) => formatDateShort(toDateString(getValue())),
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
        data={departments.data?.items ?? []}
        rowCount={departments.data?.meta.total ?? 0}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        search={{
          value: list.params.search,
          onChange: list.setSearch,
          placeholder: 'Cari kode atau nama…',
        }}
        getRowId={(row) => row.id}
        isLoading={departments.isPending}
        isFetching={departments.isFetching}
        error={departments.isError ? getErrorMessage(departments.error) : null}
        onRetry={() => void departments.refetch()}
        actions={
          <Button onClick={() => showEditing(null)}>
            <PlusIcon aria-hidden="true" />
            Tambah
          </Button>
        }
        emptyState={
          list.params.search ? undefined : (
            <EmptyState
              icon={Building2Icon}
              title="Belum ada departemen"
              description="Tambahkan departemen pertama."
            />
          )
        }
      />
      <DepartmentDialog
        department={editing.target}
        open={editing.open}
        onOpenChange={editing.onOpenChange}
      />
      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.onOpenChange}
        title={`Hapus departemen ${deleting.target?.name ?? ''}?`}
        description="Departemen yang masih dipakai karyawan tidak dapat dihapus."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => (deleting.target ? remove.mutateAsync(deleting.target.id) : undefined)}
      />
    </>
  );
}

function DepartmentDialog({
  department,
  open,
  onOpenChange,
}: {
  department: Department | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '' },
  });
  useEffect(() => {
    if (open) form.reset({ code: department?.code ?? '', name: department?.name ?? '' });
  }, [open, department, form]);

  const save = useToastMutation({
    mutationFn: (values: z.output<typeof schema>) =>
      department ? departmentsApi.update(department.id, values) : departmentsApi.create(values),
    invalidate: [masterKeys.departments],
    success: (saved) => (department ? `${saved.name} diperbarui` : `${saved.name} ditambahkan`),
    error: false,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onOpenChange(false);
    } catch (error) {
      if (!applyServerFieldErrors(error, form.setError, ['code', 'name'])) {
        toast.error('Gagal menyimpan departemen', { description: getErrorMessage(error) });
      }
    }
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={department ? 'Ubah departemen' : 'Tambah departemen'}
      formId="department-form"
      pending={save.isPending}
    >
      <form id="department-form" onSubmit={submit} noValidate>
        <FieldGroup>
          {(
            [
              ['code', 'Kode', 'IT'],
              ['name', 'Nama', 'Teknologi Informasi'],
            ] as const
          ).map(([name, label, placeholder]) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`department-${name}`}>{label}</FieldLabel>
                  <Input
                    {...field}
                    id={`department-${name}`}
                    placeholder={placeholder}
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          ))}
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
