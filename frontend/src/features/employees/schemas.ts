import { z } from '@/lib/zod';
import { passwordSchema } from '@/features/auth/schemas';
import type { CreateUserInput, Role, UpdateUserInput, User } from '@/types';

/** Sama dengan backend (`EMPLOYEE_CODE_PATTERN`, `PHONE_PATTERN`). */
const EMPLOYEE_CODE_PATTERN = /^[A-Z0-9._-]{2,30}$/;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  EMPLOYEE: 'Karyawan',
};

/** Role yang boleh diberikan oleh `actor` (ADMIN hanya boleh membuat/mengubah EMPLOYEE). */
export function assignableRoles(actor: Role | undefined): Role[] {
  if (actor === 'SUPER_ADMIN') return ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'];
  if (actor === 'ADMIN') return ['EMPLOYEE'];
  return [];
}

/** ADMIN tidak boleh mengubah/menghapus akun SUPER_ADMIN atau ADMIN lain (00-MASTER-CONTEXT). */
export function canManage(actor: Role | undefined, target: Pick<User, 'role'>): boolean {
  if (actor === 'SUPER_ADMIN') return true;
  return actor === 'ADMIN' && target.role === 'EMPLOYEE';
}

const optionalId = z.string().nullable();
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} maksimal ${max} karakter` });

const baseShape = {
  employeeCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z.string().regex(EMPLOYEE_CODE_PATTERN, {
        error: 'NIP 2–30 karakter: huruf besar, angka, titik, garis bawah, atau strip',
      }),
    ),
  name: z
    .string()
    .trim()
    .min(2, { error: 'Nama minimal 2 karakter' })
    .max(100, { error: 'Nama maksimal 100 karakter' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(150, { error: 'Email maksimal 150 karakter' })
    .pipe(z.email({ error: 'Format email tidak valid' })),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s\-().]/g, ''))
    .refine((value) => value === '' || PHONE_PATTERN.test(value), {
      error: 'Nomor telepon harus 8–15 digit (boleh diawali +)',
    }),
  position: optionalText(100, 'Jabatan'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'], { error: 'Pilih role' }),
  departmentId: optionalId,
  shiftId: optionalId,
  locationId: optionalId,
};

/**
 * Satu skema untuk tambah & ubah (tipe form sama). Password hanya divalidasi saat menambah —
 * saat mengubah, password diatur lewat "Reset password".
 */
export const employeeFormSchema = (mode: 'create' | 'update') =>
  z.object({ ...baseShape, password: z.string() }).superRefine((value, ctx) => {
    if (mode !== 'create') return;
    const result = passwordSchema.safeParse(value.password);
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: result.error.issues[0]?.message ?? 'Password tidak valid',
      });
    }
  });

export type EmployeeFormInput = z.input<ReturnType<typeof employeeFormSchema>>;
export type EmployeeFormOutput = z.output<ReturnType<typeof employeeFormSchema>>;

export const emptyEmployeeForm = (role: Role = 'EMPLOYEE'): EmployeeFormInput => ({
  employeeCode: '',
  name: '',
  email: '',
  phone: '',
  position: '',
  password: '',
  role,
  departmentId: null,
  shiftId: null,
  locationId: null,
});

export const employeeToForm = (user: User): EmployeeFormInput => ({
  employeeCode: user.employeeCode,
  name: user.name,
  email: user.email,
  phone: user.phone ?? '',
  position: user.position ?? '',
  password: '',
  role: user.role,
  departmentId: user.department?.id ?? null,
  shiftId: user.shift?.id ?? null,
  locationId: user.location?.id ?? null,
});

/** Nilai form → body API (string kosong → null untuk field opsional). */
export function toEmployeePayload(values: EmployeeFormOutput): UpdateUserInput {
  return {
    employeeCode: values.employeeCode,
    name: values.name,
    email: values.email,
    phone: values.phone || null,
    position: values.position || null,
    role: values.role,
    departmentId: values.departmentId,
    shiftId: values.shiftId,
    locationId: values.locationId,
  };
}

export const toCreatePayload = (values: EmployeeFormOutput): CreateUserInput => ({
  ...toEmployeePayload(values),
  role: values.role,
  employeeCode: values.employeeCode,
  name: values.name,
  email: values.email,
  password: values.password,
});
