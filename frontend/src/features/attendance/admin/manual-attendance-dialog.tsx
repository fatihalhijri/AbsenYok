'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { FormDialog } from '@/components/shared/form-dialog';
import { UserCombobox } from '@/components/shared/user-combobox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { dashboardKeys } from '@/features/dashboard/api';
import { employeeKeys } from '@/features/employees/api';
import { useToday } from '@/hooks/use-today';
import { getErrorMessage, toApiError } from '@/lib/error';
import { useToastMutation } from '@/lib/mutation';
import type { ManualAttendanceInput } from '@/types';
import { attendanceAdminApi, attendanceAdminKeys } from './api';
import {
  ATTENDANCE_STATUSES,
  manualFormSchema,
  type ManualFormValues,
  STATUS_LABELS,
  toManualInput,
  WORKED_STATUSES,
} from './correction';

const FORM_ID = 'manual-attendance-form';

const SERVER_FIELD_MAP: Record<string, keyof ManualFormValues> = {
  userId: 'userId',
  date: 'date',
  status: 'status',
  checkInAt: 'checkIn',
  checkOutAt: 'checkOut',
  reason: 'reason',
};

interface ManualAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tanggal awal (mis. filter tabel saat ini). */
  defaultDate?: string;
}

/** Absensi manual untuk karyawan yang lupa absen (tanggal yang sudah punya record → koreksi). */
export function ManualAttendanceDialog({
  open,
  onOpenChange,
  defaultDate,
}: ManualAttendanceDialogProps) {
  // Dialog hanya dibuka lewat aksi pengguna (setelah hydration) → tanggal selalu tersedia.
  const today = useToday() ?? '';
  const resolver = useMemo(() => zodResolver(manualFormSchema(() => new Date())), []);
  const form = useForm<ManualFormValues>({
    resolver,
    defaultValues: {
      userId: '',
      date: today,
      status: 'PRESENT',
      checkIn: '',
      checkOut: '',
      reason: '',
    },
  });
  useEffect(() => {
    if (open) {
      form.reset({
        userId: '',
        date: defaultDate && defaultDate <= today ? defaultDate : today,
        status: 'PRESENT',
        checkIn: '08:00',
        checkOut: '',
        reason: '',
      });
    }
  }, [open, defaultDate, today, form]);

  const status = useWatch({ control: form.control, name: 'status' });
  const worked = WORKED_STATUSES.has(status);
  useEffect(() => {
    // Status tanpa jam (Alpa/Sakit/Izin/Cuti) → kosongkan jam agar tidak ditolak server.
    if (!worked) {
      form.setValue('checkIn', '');
      form.setValue('checkOut', '');
    }
  }, [worked, form]);

  const save = useToastMutation({
    mutationFn: (input: ManualAttendanceInput) => attendanceAdminApi.createManual(input),
    invalidate: [attendanceAdminKeys.all, dashboardKeys.all, employeeKeys.all],
    success: () => 'Absensi manual ditambahkan',
    error: false,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toManualInput(values));
      onOpenChange(false);
    } catch (error) {
      const apiError = toApiError(error);
      let applied = false;
      for (const fieldError of apiError.fieldErrors) {
        const field = SERVER_FIELD_MAP[fieldError.field];
        if (field && fieldError.messages[0]) {
          form.setError(field, { type: 'server', message: fieldError.messages[0] });
          applied = true;
        }
      }
      if (!applied) toast.error('Gagal menambah absensi', { description: getErrorMessage(error) });
    }
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tambah absensi manual"
      description="Untuk karyawan yang lupa/tidak bisa absen. Jam dicatat dengan metode Manual."
      formId={FORM_ID}
      submitLabel="Simpan"
      pending={save.isPending}
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <FieldGroup>
          <Controller
            name="userId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="manual-user">Karyawan</FieldLabel>
                <UserCombobox
                  id="manual-user"
                  value={field.value || null}
                  onChange={(userId) => field.onChange(userId ?? '')}
                  role="EMPLOYEE"
                  activeOnly
                  placeholder="Cari & pilih karyawan…"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="date"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="manual-date">Tanggal</FieldLabel>
                  <Input
                    {...field}
                    id="manual-date"
                    type="date"
                    max={today}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            <Controller
              name="status"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="manual-status">Status</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="manual-status" className="min-h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </div>
          {worked ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['checkIn', 'Jam masuk'],
                  ['checkOut', 'Jam pulang (opsional)'],
                ] as const
              ).map(([name, label]) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`manual-${name}`}>{label}</FieldLabel>
                      <Input
                        {...field}
                        id={`manual-${name}`}
                        type="time"
                        step={60}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
              ))}
            </div>
          ) : null}
          <Controller
            name="reason"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="manual-reason">
                  Alasan <span className="text-destructive">*</span>
                </FieldLabel>
                <Textarea
                  {...field}
                  id="manual-reason"
                  rows={2}
                  maxLength={255}
                  placeholder="Mis. HP tertinggal, dikonfirmasi atasan"
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  Wajib, minimal 10 karakter. Tercatat di audit log.
                </FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
