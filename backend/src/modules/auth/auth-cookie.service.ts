import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AppConfigService } from '@/config/app.config';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, SESSION_COOKIE_NAME } from './auth.constants';

/**
 * Cookie sesi:
 * - `ay_rt`: refresh token (httpOnly, path /api/v1/auth)
 * - `ay_session=1`: penanda non-rahasia untuk redirect awal middleware Next.js (path /)
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: AppConfigService) {}

  setSessionCookies(response: Response, refreshToken: string, expiresAt: Date): void {
    const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.baseOptions(),
      path: REFRESH_COOKIE_PATH,
      maxAge,
    });
    response.cookie(SESSION_COOKIE_NAME, '1', { ...this.baseOptions(), path: '/', maxAge });
  }

  clearSessionCookies(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, { ...this.baseOptions(), path: REFRESH_COOKIE_PATH });
    response.clearCookie(SESSION_COOKIE_NAME, { ...this.baseOptions(), path: '/' });
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE'),
      sameSite: 'lax',
      domain: this.config.get('COOKIE_DOMAIN'),
    };
  }
}
