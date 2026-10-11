import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { REFRESH_COOKIE_NAME } from '../auth.constants';

/** Refresh token dari cookie `ay_rt` (dibaca cookie-parser), `undefined` bila tidak ada. */
export const RefreshTokenCookie = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const cookies = ctx.switchToHttp().getRequest<Request>().cookies as
      Record<string, unknown> | undefined;
    const token = cookies?.[REFRESH_COOKIE_NAME];
    return typeof token === 'string' && token.length > 0 ? token : undefined;
  },
);
