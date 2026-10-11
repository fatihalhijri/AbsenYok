import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@/common/types/auth-user.type';

type RequestWithUser = Request & { user?: AuthUser };

/**
 * Mengambil user terautentikasi dari `request.user`.
 * `@CurrentUser() user: AuthUser` atau `@CurrentUser('id') userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<RequestWithUser>().user;
    return field ? user?.[field] : user;
  },
);
