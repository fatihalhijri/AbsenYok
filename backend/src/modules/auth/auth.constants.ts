export const REFRESH_COOKIE_NAME = 'ay_rt';
export const SESSION_COOKIE_NAME = 'ay_session';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** BUSINESS-RULES §13: 5 kali gagal dalam 15 menit → akun dikunci 15 menit. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const FAILED_LOGIN_WINDOW_MINUTES = 15;
export const ACCOUNT_LOCK_MINUTES = 15;

/** Rate limit khusus endpoint login (per IP). */
export const LOGIN_THROTTLE = { limit: 5, ttl: 60_000 };

/** Cache data user untuk JwtAuthGuard. */
export const AUTH_USER_CACHE_TTL_MS = 30_000;

/** Refresh token yang kedaluwarsa lebih lama dari ini dihapus oleh cron harian. */
export const REFRESH_TOKEN_RETENTION_DAYS = 7;
