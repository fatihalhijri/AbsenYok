import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { getStorageToken, type ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { AuthUser } from '@/common/types/auth-user.type';

export const SCAN_RATE_LIMIT = { limit: 10, ttlMs: 60_000 };
const THROTTLER_NAME = 'scan';

/**
 * BUSINESS-RULES §7: maks 10 scan/menit **per user** (mencegah brute force token).
 * Dipasang di level route — berjalan setelah JwtAuthGuard sehingga `request.user` sudah ada
 * (throttler global berjalan sebelum autentikasi dan hanya mengenal IP).
 */
@Injectable()
export class ScanThrottleGuard implements CanActivate {
  constructor(@Inject(getStorageToken()) private readonly storage: ThrottlerStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthUser }>();
    const tracker = request.user?.id ?? request.ip ?? 'anonymous';

    const { isBlocked, timeToBlockExpire } = await this.storage.increment(
      `${THROTTLER_NAME}:${tracker}`,
      SCAN_RATE_LIMIT.ttlMs,
      SCAN_RATE_LIMIT.limit,
      0,
      THROTTLER_NAME,
    );
    if (!isBlocked) return true;

    const retryAfterSeconds = Math.max(1, timeToBlockExpire);
    http.getResponse<Response>().setHeader('Retry-After', String(retryAfterSeconds));
    throw new BusinessException(
      ErrorCode.TOO_MANY_REQUESTS,
      `Terlalu banyak percobaan scan, coba lagi dalam ${retryAfterSeconds} detik`,
      undefined,
      { retryAfterSeconds },
    );
  }
}
