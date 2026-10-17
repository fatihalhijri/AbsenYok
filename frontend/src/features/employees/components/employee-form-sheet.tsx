'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { OptionSelect } from '@/components/shared/option-select';
import { PasswordInput } from '@/components/shared/password-input';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDepartmentOptions, useLocationOptions, useShiftOptions } from '@/features/master/hooks';
import { getErrorMessage, toApiError } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { useToastMutation } from '@/lib/mutation';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/types';
import { employeeKeys, employeesApi } from '../api';
import {
  assignableRoles,
  type EmployeeFormInput,
  type EmployeeFormOutput,
  employeeFormSchema,
  employeeToForm,
  emptyEmployeeForm,
  ROLE_LABELS,
  toCreatePayload,
  toEmployeePayload,
} from '../schemas';

const FIELDS = [
  'employeeCode',
  'name',
  'email',
  'phone',
  'position',
  'password',
  'role',
  'departmentId',
  'shiftId',
  'locationId',
] as const;

interface EmployeeFormSheetProps {
  /** `null` = tambah baru; user = ubah. */
  employee: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Tambah/ubah karyawan (Sheet samping). Pilihan role dibatasi sesuai hak pengguna. */
export function EmployeeFormSheet({ employee, open, onOpenChange }: EmployeeFormSheetProps) {
  const actorRole = useAuthStore((state) => state.user?.role);
  const roles = assignableRoles(actorRole);
  const editing = employee !== null;
  const departments = useDepartmentOptions();
  const shifts = useShiftOptions();
  const locations = useLocationOptions();

  const form = useForm<EmployeeFormInput, unknown, EmployeeFormOutput>({
    resolver: zodResolver(employeeFormSchema(editing ? 'update' : 'create')),
    defaultValues: emptyEmployeeForm(),
  });

  useEffect(() => {
    if (open) form.reset(employee ? employeeToForm(employee) : emptyEmployeeForm(roles[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset hanya saat dibuka/berganti target
  }, [open, employee]);

  const save = useToastMutation({
    mutationFn: (values: EmployeeFormOutput) =>
      employee
        ? employeesApi.update(employee.id, toEmployeePayload(values))
        : employeesApi.create(toCreatePayload(values)),
    invalidate: [employeeKeys.all],
    success: (user) => (editing ? `Data ${user.name} diperbarui` : `${user.name} ditambahkan`),
    error: false,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onOpenChange(false);
    } catch (error) {
      if (!applyServerFieldErrors(error, form.setError, FIELDS)) {
        toast.error('Gagal menyimpan karyawan', { description: getErrorMessage(error) });
      } else if (toApiError(error).status === 409) {
        toast.error('Data sudah dipakai karyawan lain');
      }
    }
  });

  const text = (
    name: 'employeeCode' | 'name' | 'email' | 'phone' | 'position',
    label: string,
    extra?: {
      type?: string;
      placeholder?: string;
      autoComplete?: string;
      description?: string;
    },
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`employee-${name}`}>{label}</FieldLabel>
          <Input
            {...field}
            id={`employee-${name}`}
            type={extra?.type ?? 'text'}
            placeholder={extra?.placeholder}
            autoComplete={extra?.autoComplete ?? 'off'}
            aria-invalid={fieldState.invalid}
          />
          {extra?.description ? <FieldDescription>{extra.description}</FieldDescription> : null}
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );

  return (
    <Sheet open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? 'Ubah karyawan' : 'Tambah karyawan'}</SheetTitle>
          <SheetDescription>
            {editing
              ? 'Perubahan langsung berlaku. Password diubah lewat menu "Reset password".'
              : 'Karyawan dapat langsung login dengan email & password awal ini.'}
          </SheetDescription>
        </SheetHeader>
        <form id="employee-form" onSubmit={submit} noValidate className="px-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              {text('employeeCode', 'NIP', {
                placeholder: 'EMP011',
                description: 'Disimpan huruf besar.',
              })}
              {text('name', 'Nama lengkap', { autoComplete: 'name' })}
            </div>
            {text('email', 'Email', { type: 'email', placeholder: 'nama@kantor.id' })}
            <div className="grid gap-4 sm:grid-cols-2">
              {text('phone', 'Telepon (opsional)', { type: 'tel', placeholder: '0812…' })}
              {text('position', 'Jabatan (opsional)')}
            </div>
            {editing ? null : (
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="employee-password">Password awal</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="employee-password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      Min. 8 karakter, huruf besar, huruf kecil, dan angka.
                    </FieldDescription>
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            )}
            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="employee-role">Role</FieldLabel>
                  <OptionSelect
                    id="employee-role"
                    value={field.value}
                    onChange={(value) => value && field.onChange(value)}
                    options={roles.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                    noneLabel="Pilih role"
                    disabled={roles.length <= 1}
                    aria-invalid={fieldState.invalid}
                  />
                  {roles.length <= 1 ? (
                    <FieldDescription>Admin hanya dapat mengelola akun karyawan.</FieldDescription>
                  ) : null}
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            {(
              [
                ['departmentId', 'Departemen', departments, 'Tanpa departemen'],
                ['shiftId', 'Shift', shifts, 'Belum ada shift'],
                ['locationId', 'Lokasi kerja', locations, 'Belum ditentukan'],
              ] as const
            ).map(([name, label, query, noneLabel]) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`employee-${name}`}>{label}</FieldLabel>
                    <OptionSelect
                      id={`employee-${name}`}
                      value={field.value}
                      onChange={field.onChange}
                      options={query.data}
                      loading={query.isPending}
                      noneLabel={noneLabel}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
        </form>
        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Batal
          </Button>
          <Button type="submit" form="employee-form" disabled={save.isPending}>
            {save.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {editing ? 'Simpan perubahan' : 'Tambah karyawan'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
