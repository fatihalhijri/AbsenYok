'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormDialog } from '@/components/shared/form-dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import type { ReviewAction } from './review';

/** Catatan setujui opsional; alasan tolak wajib ≥ 5 karakter (backend `RejectLeaveDto`). */
export const reviewNoteSchema = (action: ReviewAction) =>
  z.object({
    note:
      action === 'reject'
        ? z
            .string()
            .trim()
            .min(1, { error: 'Alasan penolakan wajib diisi' })
            .min(5, { error: 'Alasan penolakan minimal 5 karakter' })
            .max(255, { error: 'Alasan penolakan maksimal 255 karakter' })
        : z.string().trim().max(255, { error: 'Catatan maksimal 255 karakter' }),
  });

export interface ReviewTarget {
  action: ReviewAction;
  ids: string[];
  /** Mis. nama karyawan (1 pengajuan) atau "10 pengajuan". */
  subject: string;
}

interface ReviewDialogProps {
  target: ReviewTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (target: ReviewTarget, note: string) => void;
}

const FORM_ID = 'leave-review-form';

/** Konfirmasi setujui (catatan opsional) / tolak (alasan wajib), satu atau banyak pengajuan. */
export function ReviewDialog({ target, open, onOpenChange, onSubmit }: ReviewDialogProps) {
  const action = target?.action ?? 'approve';
  const resolver = useMemo(() => zodResolver(reviewNoteSchema(action)), [action]);
  const form = useForm<{ note: string }>({ resolver, defaultValues: { note: '' } });
  useEffect(() => {
    if (open) form.reset({ note: '' });
  }, [open, form]);

  const submit = form.handleSubmit(({ note }) => {
    if (!target) return;
    // Optimistic: dialog langsung ditutup; hasil & rollback diringkas lewat toast.
    onSubmit(target, note.trim());
    onOpenChange(false);
  });

  const approve = action === 'approve';
  const bulk = (target?.ids.length ?? 0) > 1;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        approve
          ? bulk
            ? `Setujui ${target?.ids.length} pengajuan?`
            : 'Setujui pengajuan?'
          : 'Tolak pengajuan?'
      }
      description={
        approve
          ? `Pengajuan ${target?.subject ?? ''} disetujui; hari kerja dalam rentang tercatat sebagai izin/cuti.`
          : `Pengajuan ${target?.subject ?? ''} ditolak. Alasan dikirim ke karyawan.`
      }
      formId={FORM_ID}
      submitLabel={approve ? (bulk ? `Setujui ${target?.ids.length}` : 'Setujui') : 'Tolak'}
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Controller
          name="note"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="review-note">
                {approve ? (
                  'Catatan (opsional)'
                ) : (
                  <>
                    Alasan penolakan <span className="text-destructive">*</span>
                  </>
                )}
              </FieldLabel>
              <Textarea
                {...field}
                id="review-note"
                rows={3}
                maxLength={255}
                placeholder={
                  approve ? 'Mis. Semoga lekas sembuh' : 'Mis. Kuota cuti tim penuh minggu ini'
                }
                aria-invalid={fieldState.invalid}
              />
              {!approve ? <FieldDescription>Wajib, minimal 5 karakter.</FieldDescription> : null}
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
      </form>
    </FormDialog>
  );
}
