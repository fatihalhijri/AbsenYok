import type { Role } from '@/common/constants/roles';

/** Payload access token JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

/** User terautentikasi yang ditempel ke `request.user` oleh JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
