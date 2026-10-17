import { describe, expect, it } from 'vitest';
import { isQrDisplayable, qrRefreshDelay } from '@/lib/qr-schedule';
import { backoffDelay, KIOSK_QR_LEAD_MS, newScanIds } from './schedule';

const at = (iso: string) => Date.parse(iso);

describe('backoffDelay', () => {
  it('2, 4, 8, 16 lalu maksimal 30 detik', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(backoffDelay)).toEqual([
      2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ]);
    expect(backoffDelay(0)).toBe(0);
  });
});

describe('jadwal token kiosk (interval 30 dtk, lead 1 dtk)', () => {
  const qr = { serverTime: '2026-10-17T01:00:05.000Z', expiresAt: '2026-10-17T01:00:30.000Z' };
  const options = { leadMs: KIOSK_QR_LEAD_MS };

  it('diminta 1 dtk sebelum expiresAt', () => {
    const now = at(qr.serverTime);
    expect(qrRefreshDelay(qr, now, now, options)).toBe(24_000);
  });

  it('jam tablet terlambat 90 dtk → tetap tepat (dikoreksi offset)', () => {
    const device = at(qr.serverTime) - 90_000;
    expect(qrRefreshDelay(qr, device, device, options)).toBe(24_000);
  });

  it('token diterima di detik terakhir (jendela sama) → diminta lagi tepat setelah jendela berganti', () => {
    const late = { ...qr, serverTime: '2026-10-17T01:00:29.000Z' };
    const now = at(late.serverTime);
    expect(qrRefreshDelay(late, now, now, options)).toBe(1_300);
  });
});

describe('isQrDisplayable — tidak pernah menampilkan token kedaluwarsa', () => {
  const qr = { expiresAt: '2026-10-17T01:00:30.000Z' };
  it('sah selama jendela berjalan & jendela sesudahnya (dikurangi margin 3 dtk)', () => {
    expect(isQrDisplayable(qr, 30, at('2026-10-17T01:00:10.000Z'))).toBe(true);
    expect(isQrDisplayable(qr, 30, at('2026-10-17T01:00:56.900Z'))).toBe(true);
    expect(isQrDisplayable(qr, 30, at('2026-10-17T01:00:57.000Z'))).toBe(false);
    expect(isQrDisplayable(qr, 30, at('2026-10-17T01:05:00.000Z'))).toBe(false);
  });
});

describe('newScanIds', () => {
  const list = (...ids: string[]) => ids.map((id) => ({ id }));
  it('muatan pertama bukan "baru" (tidak berbunyi saat layar dibuka)', () => {
    expect(newScanIds(null, list('a', 'b'))).toEqual([]);
  });
  it('mendeteksi entri yang belum pernah terlihat', () => {
    expect(newScanIds(list('b', 'c'), list('a', 'b', 'c'))).toEqual(['a']);
    expect(newScanIds(list('a'), list('a'))).toEqual([]);
  });
});
