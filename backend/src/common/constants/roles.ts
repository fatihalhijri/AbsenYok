/**
 * Role pengguna. Nilainya identik dengan enum `Role` di prisma/schema.prisma sehingga
 * kompatibel secara struktural dengan enum hasil generate Prisma Client.
 */
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
