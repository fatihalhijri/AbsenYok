import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ErrorCode } from '@/common/constants/error-codes';
import type { Role } from '@/common/constants/roles';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { AuthUser } from '@/common/types/auth-user.type';

/**
 * Guard global setelah JwtAuthGuard. Tanpa `@Roles()` = semua user terautentikasi boleh;
 * role tidak cocok → 403 `FORBIDDEN`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user || !roles.includes(user.role)) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }
    return true;
  }
}
