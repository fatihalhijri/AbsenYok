import { z } from '@/lib/zod';

/** Aturan password = backend (BUSINESS-RULES §13): ≥ 8 karakter, huruf besar, huruf kecil, angka. */
export const PASSWORD_RULES = [
  { id: 'length', label: 'Minimal 8 karakter', test: (value: string) => value.length >= 8 },
  { id: 'upper', label: 'Huruf besar (A–Z)', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'lower', label: 'Huruf kecil (a–z)', test: (value: string) => /[a-z]/.test(value) },
  { id: 'digit', label: 'Angka (0–9)', test: (value: string) => /\d/.test(value) },
] as const;

/** Input login. Validasinya di form login sendiri (tanpa Zod — halaman pertama, bundle minimal). */
export interface LoginInput {
  email: string;
  password: string;
}

export const passwordSchema = z
  .string()
  .max(128, 'Password maksimal 128 karakter')
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) {
        ctx.addIssue({
          code: 'custom',
          message: `Password harus memenuhi: ${rule.label.toLowerCase()}`,
        });
        return;
      }
    }
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Ulangi password baru'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak sama',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: 'Password baru harus berbeda dari password saat ini',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Skor kekuatan 0–4 untuk indikator (aturan wajib + panjang/simbol tambahan). */
export function passwordStrength(value: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!value) return { score: 0, label: '' };
  const passed = PASSWORD_RULES.filter((rule) => rule.test(value)).length;
  if (passed < PASSWORD_RULES.length) return { score: 1, label: 'Lemah' };
  const bonus = Number(value.length >= 12) + Number(/[^A-Za-z0-9]/.test(value));
  if (bonus === 0) return { score: 2, label: 'Cukup' };
  if (bonus === 1) return { score: 3, label: 'Kuat' };
  return { score: 4, label: 'Sangat kuat' };
}
