'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Loader2Icon, ShieldAlertIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorState } from '@/components/shared/error-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { useToastMutation } from '@/lib/mutation';
import { useAuthStore } from '@/stores/auth-store';
import type { Schemas, Settings } from '@/types';
import { settingsApi, settingsKeys } from '../api';

const int = (label: string, min: number, max: number) =>
  z.coerce
    .number<string | number>({ error: `${label} harus angka` })
    .int({ error: `${label} harus bilangan bulat` })
    .min(min, { error: `${label} minimal ${min}` })
    .max(max, { error: `${label} maksimal ${max}` });

/** Batas sama dengan backend (`UpdateSettingsDto`). */
const schema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, { error: 'Nama instansi minimal 2 karakter' })
    .max(100, { error: 'Nama instansi maksimal 100 karakter' }),
  logoUrl: z
    .string()
    .trim()
    .max(255, { error: 'URL logo maksimal 255 karakter' })
    .regex(/^$|^https?:\/\/\S+$|^\/\S*$/, {
      error: 'Harus URL http(s), path diawali "/", atau kosong',
    }),
  geofenceEnabled: z.boolean(),
  deviceBindingEnabled: z.boolean(),
  minCheckoutGapMinutes: int('Jeda minimal pulang', 0, 240),
  annualQuota: int('Kuota cuti tahunan', 0, 365),
  maxRangeDays: int('Maksimal rentang izin', 1, 90),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Nama field form ↔ key pengaturan backend. */
const KEY_MAP = {
  companyName: 'company.name',
  logoUrl: 'company.logoUrl',
  geofenceEnabled: 'attendance.geofenceEnabled',
  deviceBindingEnabled: 'attendance.deviceBindingEnabled',
  minCheckoutGapMinutes: 'attendance.minCheckoutGapMinutes',
  annualQuota: 'leave.annualQuota',
  maxRangeDays: 'leave.maxRangeDays',
} as const satisfies Record<keyof FormOutput, keyof Settings>;

const toForm = (settings: Settings): FormInput =>
  Object.fromEntries(
    Object.entries(KEY_MAP).map(([field, key]) => [field, settings[key]]),
  ) as FormInput;

/** Hanya key yang berubah yang dikirim (backend mencatat audit per key). */
export function changedSettings(
  current: Settings,
  values: FormOutput,
): Schemas['UpdateSettingsDto'] {
  const patch: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(KEY_MAP) as [keyof FormOutput, keyof Settings][]) {
    if (values[field] !== current[key]) patch[key] = values[field];
  }
  return patch as Schemas['UpdateSettingsDto'];
}

/** `/admin/settings` (SUPER_ADMIN): identitas instansi & aturan absensi/cuti. */
export function SettingsForm() {
  const role = useAuthStore((state) => state.user?.role);
  const settings = useQuery({ queryKey: settingsKeys.admin(), queryFn: settingsApi.get });
  const form = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (settings.data) form.reset(toForm(settings.data));
  }, [settings.data, form]);

  const save = useToastMutation({
    mutationFn: settingsApi.update,
    invalidate: [settingsKeys.all],
    success: () => 'Pengaturan disimpan',
    error: false,
  });

  if (role !== 'SUPER_ADMIN') {
    return (
      <Alert variant="destructive">
        <ShieldAlertIcon aria-hidden="true" />
        <AlertDescription>Halaman ini khusus Super Admin.</AlertDescription>
      </Alert>
    );
  }
  if (settings.isError) {
    return (
      <ErrorState
        className="rounded-xl border"
        message={getErrorMessage(settings.error)}
        onRetry={() => void settings.refetch()}
      />
    );
  }
  if (!settings.data) return <Skeleton className="h-[520px] w-full rounded-xl" />;
  const current = settings.data;

  const submit = form.handleSubmit(async (values) => {
    const patch = changedSettings(current, values);
    if (Object.keys(patch).length === 0) {
      toast.info('Tidak ada perubahan');
      return;
    }
    try {
      await save.mutateAsync(patch);
    } catch (error) {
      // Error backend memakai nama key (mis. "company.name") → petakan ke field form.
      const reverse = Object.fromEntries(
        Object.entries(KEY_MAP).map(([field, key]) => [key, field]),
      );
      const details = (error as { details?: unknown }).details;
      let mapped = false;
      if (Array.isArray(details)) {
        for (const detail of details as { field?: string; messages?: string[] }[]) {
          const field = detail.field ? reverse[detail.field] : undefined;
          if (field && detail.messages?.[0]) {
            form.setError(field as keyof FormInput, {
              type: 'server',
              message: detail.messages[0],
            });
            mapped = true;
          }
        }
      }
      if (!mapped && !applyServerFieldErrors(error, form.setError, [])) {
        toast.error('Gagal menyimpan pengaturan', { description: getErrorMessage(error) });
      }
    }
  });

  const number = (
    name: 'minCheckoutGapMinutes' | 'annualQuota' | 'maxRangeDays',
    label: string,
    suffix: string,
    description: string,
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`settings-${name}`}>{label}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id={`settings-${name}`}
              type="number"
              inputMode="numeric"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={String(field.value ?? '')}
              onChange={(event) => field.onChange(event.target.value)}
              className="w-28 tabular-nums"
              aria-invalid={fieldState.invalid}
            />
            <span className="text-sm text-muted-foreground">{suffix}</span>
          </div>
          <FieldDescription>{description}</FieldDescription>
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );

  const toggle = (
    name: 'geofenceEnabled' | 'deviceBindingEnabled',
    label: string,
    description: string,
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <Field orientation="horizontal" className="items-start">
          <Switch
            id={`settings-${name}`}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
          />
          <div className="space-y-1">
            <FieldLabel htmlFor={`settings-${name}`}>{label}</FieldLabel>
            <FieldDescription>{description}</FieldDescription>
          </div>
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identitas instansi</CardTitle>
          <CardDescription>Tampil di halaman login, topbar, dan laporan PDF.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {(
              [
                ['companyName', 'Nama instansi', 'PT AbsenYok Indonesia'],
                ['logoUrl', 'URL logo (opsional)', 'https://… atau /uploads/logo.png'],
              ] as const
            ).map(([name, label, placeholder]) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`settings-${name}`}>{label}</FieldLabel>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      id={`settings-${name}`}
                      placeholder={placeholder}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keamanan absensi</CardTitle>
          <CardDescription>Berlaku untuk semua scan berikutnya.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {toggle(
              'geofenceEnabled',
              'Validasi lokasi (geofence)',
              'Scan hanya diterima di dalam radius lokasi kantor & akurasi GPS ≤ 100 m.',
            )}
            {toggle(
              'deviceBindingEnabled',
              'Ikat perangkat (device binding)',
              'Satu akun hanya bisa absen dari satu HP terdaftar.',
            )}
            {number(
              'minCheckoutGapMinutes',
              'Jeda minimal pulang',
              'menit',
              'Jarak minimum antara absen masuk dan absen pulang (0–240).',
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Izin & cuti</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {number('annualQuota', 'Kuota cuti tahunan', 'hari kerja / tahun', '0–365 hari kerja.')}
            {number(
              'maxRangeDays',
              'Maksimal rentang izin',
              'hari',
              'Rentang tanggal terpanjang dalam satu pengajuan (1–90).',
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset(toForm(current))}
          disabled={save.isPending || !form.formState.isDirty}
        >
          Batalkan perubahan
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
          Simpan pengaturan
        </Button>
      </div>
    </form>
  );
}
