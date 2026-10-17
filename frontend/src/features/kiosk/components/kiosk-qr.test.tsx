// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KioskQr as KioskQrData } from '@/types';
import { KioskQr } from './kiosk-qr';

const T0 = Date.parse('2026-10-17T01:00:05.000Z');
const qrFor = (window: number): KioskQrData => ({
  token: `AY1.K.k1.${window}.sig${window}`,
  expiresAt: new Date((window + 1) * 30_000).toISOString(),
  intervalSeconds: 30,
  serverTime: new Date(T0).toISOString(),
  kiosk: { id: 'k1', name: 'Lobi Utama', locationName: 'Kantor Pusat' },
});
const W0 = Math.floor(T0 / 30_000);

const layers = () =>
  [...document.querySelectorAll('svg[data-kiosk-qr]')].map((el) =>
    el.getAttribute('data-kiosk-qr'),
  );

describe('KioskQr', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('token berganti → crossfade (lama memudar) lalu hanya token baru', () => {
    const { rerender } = render(<KioskQr qr={qrFor(W0)} offsetMs={0} />);
    expect(layers()).toEqual(['current']);

    rerender(<KioskQr qr={qrFor(W0 + 1)} offsetMs={0} />);
    expect(layers()).toEqual(['previous', 'current']);
    expect(
      document.querySelector('svg[data-kiosk-qr="current"]')?.getAttribute('data-token-window'),
    ).toBe(String(W0 + 1));

    act(() => vi.advanceTimersByTime(600));
    expect(layers()).toEqual(['current']);
  });

  it('token sudah lewat batas sah → QR disembunyikan', () => {
    render(<KioskQr qr={qrFor(W0 - 3)} offsetMs={0} />);
    act(() => vi.advanceTimersByTime(1_100));
    expect(screen.getByTestId('qr-expired')).toBeTruthy();
    expect(layers()).toEqual([]);
  });
});
