import { describe, expect, it } from 'vitest';
import { hasSessionCookie } from './routing';

describe('hasSessionCookie', () => {
  it('mendeteksi penanda sesi di antara cookie lain', () => {
    expect(hasSessionCookie('theme=dark; ay_session=1')).toBe(true);
    expect(hasSessionCookie('ay_session=1')).toBe(true);
  });

  it('tanpa penanda / nama mirip → belum login', () => {
    expect(hasSessionCookie('')).toBe(false);
    expect(hasSessionCookie('theme=dark')).toBe(false);
    expect(hasSessionCookie('xay_session=1; ay_session_old=1')).toBe(false);
  });
});
