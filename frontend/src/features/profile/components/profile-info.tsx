'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BriefcaseBusinessIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  SmartphoneIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatWorkDays } from '@/features/attendance/components/shift-info';
import { applyServerFieldErrors } from '@/lib/form';
import { getErrorMessage } from '@/lib/error';
import type { UserProfile } from '@/types';
import { useUpdateMe } from '../hooks';

/** Data akun: email, telepon (bisa diubah), shift, lokasi kerja, status perangkat. */
export function ProfileInfo({ user }: { user: UserProfile }) {
  const [editingPhone, setEditingPhone] = useState(false);
  const shift = user.shift;
  return (
    <section aria-label="Informasi akun" className="rounded-2xl border bg-card">
      <dl className="divide-y">
        <Row icon={MailIcon} label="Email" value={user.email} />
        <Row
          icon={PhoneIcon}
          label="Telepon"
          value={user.phone || 'Belum diisi'}
          muted={!user.phone}
          action={
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Ubah nomor telepon"
              onClick={() => setEditingPhone(true)}
            >
              <PencilIcon aria-hidden="true" />
            </Button>
          }
        />
        <Row
          icon={BriefcaseBusinessIcon}
          label="Shift"
          value={
            shift
              ? `${shift.name} · ${shift.startTime}–${shift.endTime} · ${formatWorkDays(shift.workDays)}`
              : 'Belum ada shift'
          }
          muted={!shift}
        />
        <Row
          icon={MapPinIcon}
          label="Lokasi kerja"
          value={user.location?.name ?? 'Belum ditentukan'}
          muted={!user.location}
        />
        <Row
          icon={SmartphoneIcon}
          label="Status perangkat"
          value={
            user.hasBoundDevice
              ? 'Perangkat terdaftar ✓'
              : 'Belum terdaftar — otomatis terikat saat scan pertama'
          }
          valueClassName={user.hasBoundDevice ? 'text-success font-medium' : undefined}
          hint={
            user.hasBoundDevice
              ? 'Akun terikat ke satu HP. Ganti HP? Hubungi admin untuk reset perangkat.'
              : undefined
          }
        />
      </dl>
      <PhoneDialog open={editingPhone} onOpenChange={setEditingPhone} phone={user.phone ?? ''} />
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  muted,
  hint,
  action,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  muted?: boolean;
  hint?: string;
  action?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={
            valueClassName ?? (muted ? 'text-sm text-muted-foreground' : 'text-sm break-words')
          }
        >
          {value}
        </dd>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Sama dengan backend `PHONE_PATTERN` (spasi, strip, titik & kurung dibuang dulu). */
const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s\-().]/g, ''))
    .refine((value) => value === '' || /^\+?\d{8,15}$/.test(value), {
      error: 'Nomor telepon harus 8–15 digit (boleh diawali +)',
    }),
});

function PhoneDialog({
  open,
  onOpenChange,
  phone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
}) {
  const update = useUpdateMe();
  const form = useForm<z.input<typeof phoneSchema>, unknown, z.output<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    values: { phone },
  });

  const submit = form.handleSubmit(async ({ phone: value }) => {
    try {
      await update.mutateAsync({ phone: value === '' ? null : value });
      toast.success(value ? 'Nomor telepon disimpan' : 'Nomor telepon dihapus');
      onOpenChange(false);
    } catch (error) {
      if (!applyServerFieldErrors(error, form.setError, ['phone'])) {
        toast.error('Gagal menyimpan', { description: getErrorMessage(error) });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !update.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nomor telepon</DialogTitle>
          <DialogDescription>Dipakai admin untuk menghubungi Anda.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="profile-phone">Nomor HP</FieldLabel>
                <Input
                  {...field}
                  id="profile-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="081234567890"
                  aria-invalid={fieldState.invalid}
                  className="h-11"
                />
                <FieldDescription>Kosongkan untuk menghapus.</FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              Batal
            </Button>
            <Button type="submit" className="min-h-11" disabled={update.isPending}>
              {update.isPending ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
