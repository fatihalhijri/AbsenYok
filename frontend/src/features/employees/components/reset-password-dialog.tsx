'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from '@/lib/zod';
import { PasswordInput } from '@/components/shared/password-input';
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
import { passwordSchema } from '@/features/auth/schemas';
import { applyServerFieldErrors } from '@/lib/form';
import { useToastMutation } from '@/lib/mutation';
import type { User } from '@/types';
import { employeeKeys, employeesApi } from '../api';

const schema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Konfirmasi password tidak sama',
  });

/** Admin mengatur password baru karyawan (sesi karyawan di perangkat lain akan berakhir). */
export function ResetPasswordDialog({
  employee,
  open,
  onClose,
}: {
  employee: User | null;
  open: boolean;
  onClose: () => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  useEffect(() => {
    if (open) form.reset({ newPassword: '', confirmPassword: '' });
  }, [open, form]);

  const reset = useToastMutation({
    mutationFn: (newPassword: string) =>
      employeesApi.resetPassword(employee?.id ?? '', newPassword),
    invalidate: [employeeKeys.all],
    success: () => `Password ${employee?.name ?? 'karyawan'} diperbarui`,
    error: 'Gagal mengatur password',
  });

  const submit = form.handleSubmit(async ({ newPassword }) => {
    try {
      await reset.mutateAsync(newPassword);
      onClose();
    } catch (error) {
      applyServerFieldErrors(error, form.setError, ['newPassword']);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(open) => !open && !reset.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Atur password baru untuk <strong>{employee?.name}</strong>. Sampaikan password ini
            secara langsung ke yang bersangkutan.
          </DialogDescription>
        </DialogHeader>
        <form id="reset-password-form" onSubmit={submit} noValidate className="space-y-4">
          {(['newPassword', 'confirmPassword'] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`reset-${name}`}>
                    {name === 'newPassword' ? 'Password baru' : 'Ulangi password baru'}
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={`reset-${name}`}
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  {name === 'newPassword' ? (
                    <FieldDescription>
                      Min. 8 karakter, huruf besar, huruf kecil, dan angka.
                    </FieldDescription>
                  ) : null}
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          ))}
        </form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={reset.isPending}>
            Batal
          </Button>
          <Button type="submit" form="reset-password-form" disabled={reset.isPending}>
            {reset.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            Simpan password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
