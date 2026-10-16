// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { idb } = vi.hoisted(() => ({ idb: new Map<string, unknown>() }));
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => idb.get(key)),
  set: vi.fn(async (key: string, value: unknown) => void idb.set(key, value)),
}));

const { DEVICE_ID_KEY, getDeviceId } = await import('./device-id');

const UUID = /^[0-9a-f-]{36}$/;

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
    idb.clear();
  });

  it('membuat UUID baru sekali lalu menyimpannya di localStorage & IndexedDB', async () => {
    const first = await getDeviceId();
    expect(first).toMatch(UUID);
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(first);
    expect(idb.get(DEVICE_ID_KEY)).toBe(first);
    expect(await getDeviceId()).toBe(first);
  });

  it('localStorage terhapus → dipulihkan dari cadangan IndexedDB', async () => {
    const original = await getDeviceId();
    localStorage.clear();
    expect(await getDeviceId()).toBe(original);
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(original);
  });

  it('panggilan bersamaan menghasilkan ID yang sama', async () => {
    const ids = await Promise.all([getDeviceId(), getDeviceId(), getDeviceId()]);
    expect(new Set(ids).size).toBe(1);
  });

  it('nilai rusak di localStorage diabaikan', async () => {
    localStorage.setItem(DEVICE_ID_KEY, 'bukan-uuid');
    const id = await getDeviceId();
    expect(id).toMatch(UUID);
    expect(id).not.toBe('bukan-uuid');
  });
});
