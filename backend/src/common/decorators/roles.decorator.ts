import { SetMetadata } from '@nestjs/common';
import type { Role } from '@/common/constants/roles';

export const ROLES_KEY = 'roles';

/** Membatasi endpoint ke role tertentu (diperiksa RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
