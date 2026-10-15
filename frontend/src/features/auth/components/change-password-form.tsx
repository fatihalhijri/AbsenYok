'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlertIcon, KeyRoundIcon, Loader2Icon } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/shared/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { toApiError } from '@/lib/error';
import { useAuthStore } from '@/stores/auth-store';
import { applyServerFieldErrors } from '@/lib/form';
import { useChangePassword, useEndSession } from '../hooks';
import { type ChangePasswordInput, changePasswordSchema } from '../schemas';
import { PasswordStrength } from './password-strength';

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;

/**
 * Form ganti password (dipakai di halaman profil). Backend mencabut semua sesi setelah password
 * diganti, jadi user diminta masuk kembali.
 */
export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const endSession = useEndSession();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });
  const email = useAuthStore((state) => state.user?.email ?? '');

  const onSubmit = form.handleSubmit((values) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        toast.success('Password berhasil diganti', {
          description: 'Semua sesi telah keluar. Silakan masuk kembali dengan password baru.',
        });
        endSession();
      },
      onError: (error) => {
        if (!applyServerFieldErrors(error, form.setError, FIELDS)) return;
        changePassword.reset();
      },
    });
  });

  const error = changePassword.error ? toApiError(changePassword.error) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Ganti password">
      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {/* Petunjuk akun untuk password manager (disarankan browser). */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <FieldGroup>
        <Controller
          name="currentPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="current-password">Password saat ini</FieldLabel>
              <PasswordInput
                {...field}
                id="current-password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Controller
          name="newPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-password">Password baru</FieldLabel>
              <PasswordInput
                {...field}
                id="new-password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby="new-password-strength"
              />
              <PasswordStrength id="new-password-strength" value={newPassword} />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="confirm-password">Ulangi password baru</FieldLabel>
              <PasswordInput
                {...field}
                id="confirm-password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>Setelah diganti, Anda perlu masuk kembali.</FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="h-11 w-full sm:w-auto" disabled={changePassword.isPending}>
        {changePassword.isPending ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <KeyRoundIcon aria-hidden="true" />
        )}
        Ganti password
      </Button>
    </form>
  );
}
