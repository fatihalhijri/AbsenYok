import { type NextRequest, NextResponse } from 'next/server';
// Cookie penanda sesi non-rahasia dari backend (BE-03). `ay_rt` ber-path /api/v1/auth.
import { SESSION_COOKIE } from '@/features/auth/routing';

/**
 * Redirect cepat ke login bila area terproteksi dibuka tanpa sesi. Hanya untuk UX — otorisasi
 * sebenarnya tetap di backend & RoleGate. `/login` dengan cookie dibiarkan: client yang memutuskan
 * setelah refresh (cookie bisa saja masih ada walau sesi sudah dicabut).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*', '/kiosk/:path*'],
};
