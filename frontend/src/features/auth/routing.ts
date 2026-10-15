import type { Role } from '@/types';

/** Beranda sesuai role. */
export const homePathFor = (role: Role) => (role === 'EMPLOYEE' ? '/app' : '/admin');

/** Area URL yang boleh dibuka role tsb (dipakai untuk memvalidasi `?next=`). */
const AREAS: Record<Role, string[]> = {
  EMPLOYEE: ['/app'],
  ADMIN: ['/admin', '/kiosk'],
  SUPER_ADMIN: ['/admin', '/kiosk'],
};

const inArea = (path: string, area: string) =>
  path === area || path.startsWith(`${area}/`) || path.startsWith(`${area}?`);

/**
 * Tujuan setelah login: `next` hanya dipakai bila path internal (bukan `//host` / URL absolut)
 * dan berada di area role tsb; selain itu ke beranda role (mencegah open redirect).
 */
export function resolvePostLoginPath(next: string | null, role: Role): string {
  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\') &&
    AREAS[role].some((area) => inArea(next, area))
  ) {
    return next;
  }
  return homePathFor(role);
}

/** URL login dengan `next` (path saat ini). */
export const loginPathWithNext = (next: string | null) =>
  next ? `/login?next=${encodeURIComponent(next)}` : '/login';
