import type { Role } from '@/common/constants/roles';

/** Payload access token JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  jti: string;
  iat?: number;
  exp?: number;
}

/** Payload refresh token JWT (secret terpisah). */
export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
  jti: string;
  iat?: number;
  exp?: number;
}

/** User terautentikasi yang ditempel ke `request.user` oleh JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
