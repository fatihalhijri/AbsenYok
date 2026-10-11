import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ErrorCode } from '@/common/constants/error-codes';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { AuthUser } from '@/common/types/auth-user.type';
import { TokenService } from '@/modules/auth/token.service';
import { UserAuthCacheService } from '@/modules/auth/user-auth-cache.service';

const BEARER_PREFIX = 'Bearer ';

/**
 * Guard global: wajib access token kecuali endpoint `@Public()`.
 * - kedaluwarsa → 401 `TOKEN_EXPIRED` (frontend memicu refresh)
 * - tidak ada / rusak / user terhapus → 401 `TOKEN_INVALID`
 * - user nonaktif → 403 `ACCOUNT_INACTIVE`
 * Role diambil dari database (cache 30 detik), bukan dari payload token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly userCache: UserAuthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 'Silakan login terlebih dahulu');
    }

    const payload = await this.tokens.verifyAccessToken(token);
    const user = await this.userCache.get(payload.sub);
    if (!user) throw new BusinessException(ErrorCode.TOKEN_INVALID);
    if (!user.isActive) throw new BusinessException(ErrorCode.ACCOUNT_INACTIVE);

    request.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) return null;
    const token = header.slice(BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
  }
}
