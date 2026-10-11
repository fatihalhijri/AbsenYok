import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { JwtPayload, RefreshTokenPayload } from '@/common/types/auth-user.type';
import { durationToSeconds } from '@/common/utils/duration.util';
import { AppConfigService } from '@/config/app.config';

const ALGORITHM = 'HS256';
const ROLES = new Set<string>(Object.values(Role));

export interface SignedAccessToken {
  token: string;
  /** Masa berlaku dalam detik. */
  expiresIn: number;
}

export interface SignedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isRole = (value: unknown): value is Role => typeof value === 'string' && ROLES.has(value);

/** Penerbitan & verifikasi JWT access/refresh token (secret terpisah, algoritma dikunci HS256). */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {
    this.accessTtlSeconds = durationToSeconds(config.get('JWT_ACCESS_EXPIRES_IN'));
    this.refreshTtlSeconds = durationToSeconds(config.get('JWT_REFRESH_EXPIRES_IN'));
  }

  async signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
  }): Promise<SignedAccessToken> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTtlSeconds,
      algorithm: ALGORITHM,
    });
    return { token, expiresIn: this.accessTtlSeconds };
  }

  /** Melempar `TOKEN_EXPIRED` (frontend memicu refresh) atau `TOKEN_INVALID`. */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        algorithms: [ALGORITHM],
      });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new BusinessException(ErrorCode.TOKEN_EXPIRED);
      }
      throw new BusinessException(ErrorCode.TOKEN_INVALID);
    }

    const { sub, email, role, jti } = payload;
    if (
      !isNonEmptyString(sub) ||
      !isNonEmptyString(email) ||
      !isNonEmptyString(jti) ||
      !isRole(role)
    ) {
      throw new BusinessException(ErrorCode.TOKEN_INVALID);
    }
    return { sub, email, role, jti };
  }

  async signRefreshToken(userId: string, familyId: string): Promise<SignedRefreshToken> {
    const jti = randomUUID();
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = { sub: userId, familyId, jti };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.refreshTtlSeconds,
      algorithm: ALGORITHM,
    });
    return { token, jti, expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1_000) };
  }

  /** `null` bila tanda tangan tidak valid, kedaluwarsa, atau payload rusak. */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        algorithms: [ALGORITHM],
      });
      const { sub, familyId, jti } = payload;
      if (!isNonEmptyString(sub) || !isNonEmptyString(familyId) || !isNonEmptyString(jti)) {
        return null;
      }
      return { sub, familyId, jti };
    } catch {
      return null;
    }
  }

  /** Refresh token tidak pernah disimpan mentah: hanya SHA-256 hex (64 karakter). */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
