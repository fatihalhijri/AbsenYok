'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRightIcon, EraserIcon, InfoIcon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { FormDialog } from '@/components/shared/form-dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
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
import { formatDateLong, formatMinutes, formatTime } from '@/lib/date';
import { getErrorMessage, toApiError } from '@/lib/error';
import { useToastMutation } from '@/lib/mutation';
import { cn } from '@/lib/utils';
import type { AttendanceDetail, AttendanceStatus, CorrectAttendanceInput } from '@/types';
import { attendanceAdminApi, attendanceAdminKeys } from './api';
import {
  ATTENDANCE_STATUSES,
  AUTO_STATUS,
  correctionDefaults,
  correctionFormSchema,
  type CorrectionFormValues,
  previewCorrection,
  STATUS_LABELS,
} from './correction';

const FORM_ID = 'attendance-correction-form';

/** Field error backend → field form. */
const SERVER_FIELD_MAP: Record<string, keyof CorrectionFormValues> = {
  checkInAt: 'checkIn',
  checkOutAt: 'checkOut',
  status: 'status',
  note: 'note',
  reason: 'reason',
};

interface CorrectionDialogProps {
  detail: AttendanceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Koreksi absensi oleh admin: ubah jam/status/catatan + alasan wajib (≥ 10 karakter). Preview
 * hasil hitung ulang (status, terlambat, pulang cepat, lama kerja) tampil sebelum disimpan.
 */
export function CorrectionDialog({ detail, open, onOpenChange }: CorrectionDialogProps) {
  // Skema bergantung pada record (preview & konsistensi jam) — dibuat ulang per record.
  const resolver = useMemo(
    () => (detail ? zodResolver(correctionFormSchema(detail, () => new Date())) : undefined),
    [detail],
  );
  const form = useForm<CorrectionFormValues>({
    resolver,
    defaultValues: {
      checkIn: '',
      checkOut: '',
      status: AUTO_STATUS,
      note: '',
      reason: '',
    },
  });
  useEffect(() => {
    if (open && detail) form.reset(correctionDefaults(detail));
  }, [open, detail, form]);

  const values = useWatch({ control: form.control }) as CorrectionFormValues;
  const preview = detail && values.status ? previewCorrection(detail, values, new Date()) : null;

  const save = useToastMutation({
    mutationFn: (input: CorrectAttendanceInput) =>
      attendanceAdminApi.correct(detail?.id ?? '', input),
    invalidate: [attendanceAdminKeys.all, dashboardKeys.all, employeeKeys.all],
    success: () => 'Absensi dikoreksi',
    error: false,
  });

  const submit = form.handleSubmit(async (formValues) => {
    if (!detail) return;
    const result = previewCorrection(detail, formValues, new Date());
    try {
      await save.mutateAsync({ ...result.payload, reason: formValues.reason.trim() });
      onOpenChange(false);
    } catch (error) {
      let applied = false;
      for (const fieldError of toApiError(error).fieldErrors) {
        const field = SERVER_FIELD_MAP[fieldError.field];
        if (field && fieldError.messages[0]) {
          form.setError(field, { type: 'server', message: fieldError.messages[0] });
          applied = true;
        }
      }
      if (!applied) toast.error('Gagal menyimpan koreksi', { description: getErrorMessage(error) });
    }
  });

  const rootError = form.formState.errors.root?.message;
  const reasonLength = values.reason?.trim().length ?? 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Koreksi absensi"
      description={
        detail ? (
          <>
            {detail.user.name} · {detail.user.employeeCode} · {formatDateLong(detail.date)}
          </>
        ) : null
      }
      formId={FORM_ID}
      submitLabel="Simpan koreksi"
      pending={save.isPending}
      submitDisabled={!preview?.changed}
      className="sm:max-w-2xl"
    >
      {detail ? (
        <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-5">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['checkIn', 'Jam masuk'],
                  ['checkOut', 'Jam pulang'],
                ] as const
              ).map(([name, label]) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`correction-${name}`}>{label}</FieldLabel>
                      <div className="flex gap-1">
                        <Input
                          {...field}
                          id={`correction-${name}`}
                          type="time"
                          step={60}
                          aria-invalid={fieldState.invalid}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 shrink-0"
                          disabled={!field.value}
                          aria-label={`Kosongkan ${label.toLowerCase()}`}
                          onClick={() =>
                            form.setValue(name, '', { shouldValidate: form.formState.isSubmitted })
                          }
                        >
                          <EraserIcon aria-hidden="true" />
                        </Button>
                      </div>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
              ))}
            </div>

            <Controller
              name="status"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="correction-status">Status</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="correction-status"
                      className="min-h-10 w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO_STATUS}>
                        Otomatis (saat ini {STATUS_LABELS[detail.status as AttendanceStatus]};
                        dihitung ulang bila jam masuk berubah)
                      </SelectItem>
                      {ATTENDANCE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Hadir/Terlambat wajib punya jam masuk; status lain tanpa jam.
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="note"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="correction-note">Catatan (opsional)</FieldLabel>
                  <Textarea
                    {...field}
                    id="correction-note"
                    rows={2}
                    maxLength={255}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="reason"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="correction-reason">
                    Alasan koreksi <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="correction-reason"
                    rows={2}
                    maxLength={255}
                    required
                    placeholder="Mis. Sesuai rekaman CCTV lobi utama"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription className="flex justify-between gap-2">
                    <span>Wajib, minimal 10 karakter. Tercatat di audit log.</span>
                    <span className="tabular-nums">{reasonLength}/255</span>
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </FieldGroup>

          {preview ? <CorrectionPreviewPanel detail={detail} preview={preview} /> : null}
          {rootError && preview?.changed === false ? (
            <p className="text-sm text-destructive" role="alert">
              {rootError}
            </p>
          ) : null}
        </form>
      ) : null}
    </FormDialog>
  );
}

function CorrectionPreviewPanel({
  detail,
  preview,
}: {
  detail: AttendanceDetail;
  preview: ReturnType<typeof previewCorrection>;
}) {
  const time = (value: Date | string | null | undefined) => (value ? formatTime(value) : '—');
  const rows: {
    label: string;
    before: ReactNode;
    after: ReactNode;
    changed: boolean;
  }[] = [
    {
      label: 'Status',
      before: <StatusBadge status={detail.status as AttendanceStatus} />,
      after: preview.statusKnown ? (
        <StatusBadge status={preview.status} />
      ) : (
        <span className="text-muted-foreground">Dihitung server</span>
      ),
      changed: !preview.statusKnown || preview.status !== detail.status,
    },
    {
      label: 'Jam masuk',
      before: time(detail.checkInAt),
      after: time(preview.checkInAt),
      changed: time(detail.checkInAt) !== time(preview.checkInAt),
    },
    {
      label: 'Jam pulang',
      before: time(detail.checkOutAt),
      after: time(preview.checkOutAt),
      changed: time(detail.checkOutAt) !== time(preview.checkOutAt),
    },
    ...(
      [
        ['lateMinutes', 'Terlambat'],
        ['earlyLeaveMinutes', 'Pulang cepat'],
        ['workMinutes', 'Lama kerja'],
      ] as const
    ).map(([key, label]) => ({
      label,
      before: formatMinutes(detail[key]),
      after: preview.metrics ? formatMinutes(preview.metrics[key]) : '—',
      changed: preview.metrics ? preview.metrics[key] !== detail[key] : false,
    })),
  ];

  return (
    <section
      aria-labelledby="correction-preview-title"
      className="rounded-xl border bg-muted/40 p-4"
      data-testid="correction-preview"
    >
      <h3 id="correction-preview-title" className="mb-3 text-sm font-semibold">
        Preview hasil hitung ulang
      </h3>
      {!preview.changed ? (
        <p className="text-sm text-muted-foreground">
          Ubah minimal satu data untuk menyimpan koreksi.
        </p>
      ) : (
        <dl className="grid gap-x-4 gap-y-2 text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className={cn(
                'grid grid-cols-[7.5rem_1fr_auto_1fr] items-center gap-2 rounded-md px-2 py-1',
                row.changed && 'bg-primary/5 font-medium',
              )}
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="tabular-nums">{row.before}</dd>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-label="menjadi" />
              <dd className="tabular-nums">{row.after}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview.metrics === null ? (
        <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Record ini belum menyimpan snapshot shift; menit terlambat & lama kerja dihitung server
          dari shift karyawan saat ini.
        </p>
      ) : null}
    </section>
  );
}
