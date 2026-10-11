import { Injectable } from '@nestjs/common';
import {
  conflictError,
  type FieldError,
  validationError,
} from '@/common/exceptions/error-factories';
import { PrismaService } from '@/prisma/prisma.service';

export interface UserRelations {
  departmentId?: string | null;
  shiftId?: string | null;
  locationId?: string | null;
}

export interface UserIdentity {
  email?: string;
  employeeCode?: string;
}

/** Validasi relasi & keunikan user — dipakai CRUD dan import XLSX. */
@Injectable()
export class UserIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Departemen harus ada; shift & lokasi harus ada dan aktif. */
  async assertRelations({ departmentId, shiftId, locationId }: UserRelations): Promise<void> {
    const [department, shift, location] = await Promise.all([
      departmentId
        ? this.prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } })
        : null,
      shiftId
        ? this.prisma.shift.findUnique({ where: { id: shiftId }, select: { isActive: true } })
        : null,
      locationId
        ? this.prisma.location.findUnique({ where: { id: locationId }, select: { isActive: true } })
        : null,
    ]);

    const errors: FieldError[] = [];
    if (departmentId && !department) {
      errors.push({ field: 'departmentId', messages: ['Departemen tidak ditemukan'] });
    }
    if (shiftId && !shift?.isActive) {
      errors.push({ field: 'shiftId', messages: ['Shift tidak ditemukan atau tidak aktif'] });
    }
    if (locationId && !location?.isActive) {
      errors.push({ field: 'locationId', messages: ['Lokasi tidak ditemukan atau tidak aktif'] });
    }
    if (errors.length > 0) throw validationError(errors);
  }

  /**
   * Email & kode karyawan unik, termasuk terhadap akun yang sudah dihapus (soft delete)
   * karena constraint unik di database tetap berlaku.
   */
  async assertUniqueIdentity(identity: UserIdentity, excludeUserId?: string): Promise<void> {
    const errors = await this.findIdentityConflicts([identity], excludeUserId);
    if (errors.length > 0) {
      throw conflictError(
        'Data sudah ada',
        errors.map(({ field, message }) => ({ field, messages: [message] })),
      );
    }
  }

  /** Konflik untuk banyak identitas sekaligus (import); `index` menunjuk elemen input. */
  async findIdentityConflicts(
    identities: UserIdentity[],
    excludeUserId?: string,
  ): Promise<{ index: number; field: 'email' | 'employeeCode'; message: string }[]> {
    const emails = identities.map((i) => i.email).filter((v): v is string => Boolean(v));
    const codes = identities.map((i) => i.employeeCode).filter((v): v is string => Boolean(v));
    if (emails.length === 0 && codes.length === 0) return [];

    const existing = await this.prisma.user.findMany({
      where: {
        OR: [
          ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
          ...(codes.length > 0 ? [{ employeeCode: { in: codes } }] : []),
        ],
        ...(excludeUserId && { NOT: { id: excludeUserId } }),
      },
      select: { email: true, employeeCode: true, deletedAt: true },
    });

    const suffix = (deletedAt: Date | null) => (deletedAt ? ' oleh akun yang sudah dihapus' : '');
    const conflicts: { index: number; field: 'email' | 'employeeCode'; message: string }[] = [];

    identities.forEach((identity, index) => {
      const emailOwner = existing.find(
        (u) => identity.email && u.email.toLowerCase() === identity.email.toLowerCase(),
      );
      if (emailOwner) {
        conflicts.push({
          index,
          field: 'email',
          message: `Email sudah digunakan${suffix(emailOwner.deletedAt)}`,
        });
      }
      const codeOwner = existing.find(
        (u) =>
          identity.employeeCode &&
          u.employeeCode.toUpperCase() === identity.employeeCode.toUpperCase(),
      );
      if (codeOwner) {
        conflicts.push({
          index,
          field: 'employeeCode',
          message: `Kode karyawan sudah digunakan${suffix(codeOwner.deletedAt)}`,
        });
      }
    });
    return conflicts;
  }
}
