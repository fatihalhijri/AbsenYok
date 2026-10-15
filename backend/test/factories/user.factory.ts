import type { Role } from '@/common/constants/roles';
import { hashPassword } from '@/common/utils/password.util';
import type { Prisma } from '@/generated/prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

/** Password semua user buatan factory (hash argon2 dihitung sekali). */
export const E2E_PASSWORD = 'Rahasia@123';

let passwordHash: Promise<string> | undefined;

export type UserFactoryInput = {
  employeeCode: string;
  email: string;
  role: Role;
} & Partial<Omit<Prisma.UserUncheckedCreateInput, 'employeeCode' | 'email' | 'role'>>;

/** Buat user langsung di database; nama default `User <kode>`. */
export async function createUser(prisma: PrismaService, data: UserFactoryInput) {
  passwordHash ??= hashPassword(E2E_PASSWORD);
  return prisma.user.create({
    data: {
      name: `User ${data.employeeCode}`,
      passwordHash: await passwordHash,
      ...data,
    },
  });
}
