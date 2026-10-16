// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './use-wake-lock';

/** WakeLockSentinel tiruan: `release()` memicu event "release" seperti browser. */
class FakeSentinel extends EventTarget {
  released = false;
  readonly type = 'screen' as const;
  onrelease = null;
  release = vi.fn(async () => {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event('release'));
  });
}

const sentinels: FakeSentinel[] = [];
const request = vi.fn(async () => {
  const sentinel = new FakeSentinel();
  sentinels.push(sentinel);
  return sentinel;
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useWakeLock', () => {
  beforeEach(() => {
    sentinels.length = 0;
    request.mockClear();
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('meminta lock saat dibuka dan melepasnya saat keluar halaman', async () => {
    const { result, unmount } = renderHook(() => useWakeLock());
    await act(async () => {});
    expect(request).toHaveBeenCalledWith('screen');
    expect(result.current).toBe('active');

    unmount();
    expect(sentinels[0]?.release).toHaveBeenCalledTimes(1);
    expect(sentinels[0]?.released).toBe(true);
  });

  it('tab disembunyikan (browser melepas lock) → diminta ulang saat terlihat lagi', async () => {
    const { result } = renderHook(() => useWakeLock());
    await act(async () => {});

    // Browser melepas lock otomatis saat halaman tersembunyi.
    await act(async () => {
      setVisibility('hidden');
      await sentinels[0]?.release();
    });
    expect(result.current).toBe('released');
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility('visible');
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current).toBe('active');
  });

  it('browser tanpa Wake Lock → "unsupported" tanpa error', () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    const { result } = renderHook(() => useWakeLock());
    expect(result.current).toBe('unsupported');
  });
});
