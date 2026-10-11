import { Role } from '@/common/constants/roles';
import { forbiddenError } from '@/common/exceptions/error-factories';
import type { AuthUser } from '@/common/types/auth-user.type';

interface ManagedUser {
  id: string;
  role: Role;
}

interface ManageOptions {
  /** Izinkan aksi pada akun sendiri (mis. SUPER_ADMIN mengubah namanya). Default: false. */
  allowSelf?: boolean;
}

/**
 * Aturan hierarki pengelolaan user (00-MASTER-CONTEXT & BE-04):
 * - SUPER_ADMIN boleh mengelola semua role.
 * - ADMIN hanya boleh mengelola user ber-role EMPLOYEE.
 * - Tidak ada yang boleh menonaktifkan/menghapus/me-reset dirinya sendiri lewat endpoint admin.
 */
export function assertCanManageUser(
  actor: AuthUser,
  target: ManagedUser,
  { allowSelf = false }: ManageOptions = {},
): void {
  if (actor.id === target.id && !allowSelf) {
    throw forbiddenError('Aksi ini tidak dapat dilakukan pada akun Anda sendiri');
  }
  if (actor.role === Role.SUPER_ADMIN) return;
  if (actor.role === Role.ADMIN && target.role === Role.EMPLOYEE) return;
  throw forbiddenError('ADMIN hanya dapat mengelola akun karyawan (EMPLOYEE)');
}

/** Role yang boleh diberikan: SUPER_ADMIN → semua, ADMIN → hanya EMPLOYEE. */
export function assertCanAssignRole(actor: AuthUser, role: Role): void {
  if (actor.role === Role.SUPER_ADMIN) return;
  if (actor.role === Role.ADMIN && role === Role.EMPLOYEE) return;
  throw forbiddenError('ADMIN hanya dapat membuat atau mengatur akun ber-role EMPLOYEE');
}
