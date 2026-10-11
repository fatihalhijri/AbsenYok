import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Info klien untuk audit log & refresh token; panjang disesuaikan dengan kolom database. */
export interface ClientInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

const MAX_IP_LENGTH = 45;
const MAX_USER_AGENT_LENGTH = 255;

export function extractClientInfo(request: Request): ClientInfo {
  // `request.ip` sudah memperhitungkan X-Forwarded-For sesuai pengaturan `trust proxy`.
  const ip = request.ip ?? request.socket?.remoteAddress ?? null;
  const userAgent = request.headers['user-agent'] ?? null;
  return {
    ipAddress: ip ? ip.slice(0, MAX_IP_LENGTH) : null,
    userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
  };
}

/** `@ClientInfo() client: ClientInfo` — IP & user-agent tanpa membuat service bergantung pada Request. */
export const ClientInfo = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  extractClientInfo(ctx.switchToHttp().getRequest<Request>()),
);
