'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  FileUpIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SmartphoneIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { initialsOf } from '@/components/layout/user-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { createDataTableColumnHelper, DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { OptionSelect } from '@/components/shared/option-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useDepartmentOptions } from '@/features/master/hooks';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { type ListParamsConfig, useListParams } from '@/hooks/use-list-params';
import { getErrorMessage } from '@/lib/error';
import { useToastMutation } from '@/lib/mutation';
import { useAuthStore } from '@/stores/auth-store';
import type { Role, User } from '@/types';
import { employeeKeys, employeesApi } from '../api';
import { canManage, ROLE_LABELS } from '../schemas';
import { EmployeeFormSheet } from './employee-form-sheet';
import { ImportDialog } from './import-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';

type Filter = 'departmentId' | 'role' | 'isActive';

/** Stabil di module scope (dipakai sebagai dependensi memo). */
const LIST_CONFIG: ListParamsConfig<Filter> = {
  sortable: ['name', 'employeeCode', 'email', 'createdAt', 'lastLoginAt'],
  defaultSort: { id: 'name', desc: false },
  filters: ['departmentId', 'role', 'isActive'],
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));
const STATUS_OPTIONS = [
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Nonaktif' },
];

const column = createDataTableColumnHelper<User>();

type Pending =
  { kind: 'device' | 'delete'; user: User } | { kind: 'status'; user: User; isActive: boolean };

/** `/admin/employees`: daftar karyawan (paginasi/sort/filter server, state di URL). */
export function EmployeesView() {
  const actor = useAuthStore((state) => state.user);
  const list = useListParams(LIST_CONFIG);
  const departments = useDepartmentOptions();
  // Target dipertahankan selama animasi tutup (judul/nama tidak berkedip).
  const form = useDialogTarget<User>();
  const password = useDialogTarget<User>();
  const [importOpen, setImportOpen] = useState(false);
  const confirmation = useDialogTarget<Pending>();
  const { show: showForm } = form;
  const { show: showPassword } = password;
  const { show: setPending } = confirmation;
  const pending = confirmation.target;

  const users = useQuery({
    queryKey: employeeKeys.list(list.query),
    queryFn: () => employeesApi.list(list.query),
    placeholderData: keepPreviousData,
  });

  const setStatus = useToastMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      employeesApi.setStatus(id, isActive),
    invalidate: [employeeKeys.all],
    success: (user) => `${user.name} ${user.isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
    error: 'Gagal mengubah status',
  });
  const resetDevice = useToastMutation({
    mutationFn: (id: string) => employeesApi.resetDevice(id),
    invalidate: [employeeKeys.all],
    success: (user) => `Perangkat ${user.name} direset — scan berikutnya akan mengikat HP baru`,
    error: 'Gagal mereset perangkat',
  });
  const remove = useToastMutation({
    mutationFn: (id: string) => employeesApi.remove(id),
    invalidate: [employeeKeys.all],
    success: () => 'Karyawan dihapus',
    error: 'Gagal menghapus karyawan',
  });

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Nama',
          meta: { label: 'Nama' },
          cell: ({ row }) => {
            const user = row.original;
            return (
              <Link
                href={`/admin/employees/${user.id}`}
                className="flex min-w-48 items-center gap-3 rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Avatar className="size-9">
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initialsOf(user.name) || <UserIcon className="size-4" aria-hidden="true" />}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{user.name}</span>
                  {user.position ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.position}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          },
        }),
        column.accessor('employeeCode', {
          header: 'NIP',
          meta: { label: 'NIP', cellClassName: 'font-mono text-xs whitespace-nowrap' },
        }),
        column.accessor('email', {
          header: 'Email',
          meta: { label: 'Email', cellClassName: 'text-sm' },
        }),
        column.accessor((user) => user.department?.name ?? '—', {
          id: 'department',
          header: 'Departemen',
          enableSorting: false,
          meta: { label: 'Departemen', cellClassName: 'whitespace-nowrap' },
        }),
        column.accessor((user) => user.shift?.name ?? '—', {
          id: 'shift',
          header: 'Shift',
          enableSorting: false,
          meta: { label: 'Shift', cellClassName: 'whitespace-nowrap' },
        }),
        column.accessor('role', {
          header: 'Role',
          enableSorting: false,
          meta: { label: 'Role' },
          cell: ({ getValue }) => (
            <Badge variant={getValue() === 'EMPLOYEE' ? 'secondary' : 'default'}>
              {ROLE_LABELS[getValue()]}
            </Badge>
          ),
        }),
        column.accessor('isActive', {
          header: 'Aktif',
          enableSorting: false,
          meta: { label: 'Status aktif' },
          cell: ({ row }) => {
            const user = row.original;
            const allowed = canManage(actor?.role, user) && user.id !== actor?.id;
            return (
              <Switch
                checked={user.isActive}
                disabled={!allowed || setStatus.isPending}
                onCheckedChange={(isActive) =>
                  isActive
                    ? setStatus.mutate({ id: user.id, isActive })
                    : setPending({ kind: 'status', user, isActive })
                }
                aria-label={`${user.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${user.name}`}
              />
            );
          },
        }),
        column.accessor('hasBoundDevice', {
          header: 'Perangkat',
          enableSorting: false,
          meta: { label: 'Perangkat' },
          cell: ({ getValue }) =>
            getValue() ? (
              <Badge variant="outline" className="border-success/40 text-success">
                Terdaftar
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Belum
              </Badge>
            ),
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Aksi</span>,
          enableHiding: false,
          meta: { className: 'w-12 text-right' },
          cell: ({ row }) => {
            const user = row.original;
            const allowed = canManage(actor?.role, user);
            const self = user.id === actor?.id;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={`Aksi untuk ${user.name}`}
                  >
                    <MoreHorizontalIcon aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/employees/${user.id}`}>
                      <UserIcon aria-hidden="true" />
                      Lihat detail
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!allowed} onSelect={() => showForm(user)}>
                    <PencilIcon aria-hidden="true" />
                    Ubah
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!allowed} onSelect={() => showPassword(user)}>
                    <KeyRoundIcon aria-hidden="true" />
                    Reset password
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!allowed || !user.hasBoundDevice}
                    onSelect={() => setPending({ kind: 'device', user })}
                  >
                    <SmartphoneIcon aria-hidden="true" />
                    Reset perangkat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!allowed || self}
                    onSelect={() =>
                      user.isActive
                        ? setPending({ kind: 'status', user, isActive: false })
                        : setStatus.mutate({ id: user.id, isActive: true })
                    }
                  >
                    <PowerIcon aria-hidden="true" />
                    {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </DropdownMenuItem>
                  {actor?.role === 'SUPER_ADMIN' ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={self}
                        onSelect={() => setPending({ kind: 'delete', user })}
                      >
                        <Trash2Icon aria-hidden="true" />
                        Hapus
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        }),
      ]),
    [actor, setStatus, showForm, showPassword, setPending],
  );

  const filtersActive = Boolean(
    list.params.search || Object.values(list.params.filters).some(Boolean),
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={users.data?.items ?? []}
        rowCount={users.data?.meta.total ?? 0}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        search={{
          value: list.params.search,
          onChange: list.setSearch,
          placeholder: 'Cari nama, NIP, atau email…',
        }}
        getRowId={(user) => user.id}
        isLoading={users.isPending}
        isFetching={users.isFetching}
        error={users.isError ? getErrorMessage(users.error) : null}
        onRetry={() => void users.refetch()}
        filters={
          <>
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
              value={list.params.filters.role}
              onChange={(value) => list.setFilter('role', value)}
              options={ROLE_OPTIONS}
              noneLabel="Semua role"
              className="w-full sm:w-36"
              aria-label="Filter role"
            />
            <OptionSelect
              value={list.params.filters.isActive}
              onChange={(value) => list.setFilter('isActive', value)}
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
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUpIcon aria-hidden="true" />
              Import XLSX
            </Button>
            <Button onClick={() => showForm(null)}>
              <PlusIcon aria-hidden="true" />
              Tambah
            </Button>
          </>
        }
        emptyState={
          filtersActive ? undefined : (
            <EmptyState
              icon={UsersIcon}
              title="Belum ada karyawan"
              description="Tambahkan satu per satu atau import dari file XLSX."
            />
          )
        }
      />

      <EmployeeFormSheet employee={form.target} open={form.open} onOpenChange={form.onOpenChange} />
      <ResetPasswordDialog
        employee={password.target}
        open={password.open}
        onClose={password.close}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmDialog
        open={confirmation.open && pending?.kind === 'device'}
        onOpenChange={confirmation.onOpenChange}
        title="Reset perangkat?"
        description={
          <>
            HP yang terdaftar untuk <strong>{pending?.user.name}</strong> akan dilepas. Lakukan bila
            karyawan ganti HP atau data browser terhapus — scan berikutnya otomatis mengikat HP yang
            dipakai saat itu.
          </>
        }
        confirmLabel="Reset perangkat"
        onConfirm={() => (pending ? resetDevice.mutateAsync(pending.user.id) : undefined)}
      />
      <ConfirmDialog
        open={confirmation.open && pending?.kind === 'status'}
        onOpenChange={confirmation.onOpenChange}
        title={`Nonaktifkan ${pending?.user.name ?? ''}?`}
        description="Akun tidak dapat login & absen sampai diaktifkan kembali. Data absensi tetap tersimpan."
        confirmLabel="Nonaktifkan"
        destructive
        onConfirm={() =>
          pending?.kind === 'status'
            ? setStatus.mutateAsync({ id: pending.user.id, isActive: pending.isActive })
            : undefined
        }
      />
      <ConfirmDialog
        open={confirmation.open && pending?.kind === 'delete'}
        onOpenChange={confirmation.onOpenChange}
        title={`Hapus ${pending?.user.name ?? ''}?`}
        description="Akun dihapus (soft delete) dan tidak tampil lagi di daftar. Riwayat absensi tetap tersimpan."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => (pending ? remove.mutateAsync(pending.user.id) : undefined)}
      />
    </>
  );
}
