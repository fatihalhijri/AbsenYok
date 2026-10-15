'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlertIcon, Loader2Icon, LogInIcon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { PasswordInput } from '@/components/shared/password-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toApiError } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import type { UserProfile } from '@/types';
import { useLogin } from '../hooks';
import { type LoginInput, loginSchema } from '../schemas';

const ALERT_TITLES: Record<string, string> = {
  ACCOUNT_LOCKED: 'Akun dikunci sementara',
  ACCOUNT_INACTIVE: 'Akun dinonaktifkan',
  TOO_MANY_REQUESTS: 'Terlalu banyak percobaan',
  NETWORK_ERROR: 'Tidak ada koneksi',
};

export function LoginForm({ onSuccess }: { onSuccess: (user: UserProfile) => void }) {
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: ({ user }) => onSuccess(user),
      onError: (error) => {
        applyServerFieldErrors(error, form.setError, ['email', 'password']);
        // Password dikosongkan setelah gagal; email dipertahankan.
        form.resetField('password', { keepError: true });
      },
    });
  });

  const error = login.error ? toApiError(login.error) : null;
  const title = error ? (ALERT_TITLES[error.code] ?? 'Gagal masuk') : '';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Form masuk">
      {error && error.fieldErrors.length === 0 ? (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlertIcon aria-hidden="true" />
          {/* Judul tidak diulang bila pesan backend sudah diawali kalimat yang sama. */}
          {error.message.startsWith(title) ? (
            <AlertTitle>{error.message}</AlertTitle>
          ) : (
            <>
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </>
          )}
        </Alert>
      ) : null}

      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="nama@instansi.co.id"
                className="h-11"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <PasswordInput
                {...field}
                id="login-password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={login.isPending}>
        {login.isPending ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <LogInIcon aria-hidden="true" />
        )}
        {login.isPending ? 'Memproses…' : 'Masuk'}
      </Button>
    </form>
  );
}
