import { get, set } from 'idb-keyval';

/** Kunci penyimpanan ID perangkat (lihat docs/QR-SECURITY.md §D). */
export const DEVICE_ID_KEY = 'ay_device_id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

function readLocal(): string | null {
  try {
    const value = localStorage.getItem(DEVICE_ID_KEY);
    return isUuid(value) ? value : null;
  } catch {
    return null; // mode privat / storage diblokir
  }
}

function writeLocal(value: string) {
  try {
    localStorage.setItem(DEVICE_ID_KEY, value);
  } catch {
    /* tetap lanjut: IndexedDB jadi satu-satunya penyimpanan */
  }
}

async function readBackup(): Promise<string | null> {
  try {
    const value = await get<unknown>(DEVICE_ID_KEY);
    return isUuid(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeBackup(value: string) {
  try {
    await set(DEVICE_ID_KEY, value);
  } catch {
    /* IndexedDB tidak tersedia — localStorage sudah cukup */
  }
}

let pending: Promise<string> | null = null;

/**
 * ID perangkat untuk device binding. Urutan: localStorage → cadangan IndexedDB (dipulihkan ke
 * localStorage) → buat baru `crypto.randomUUID()`. Selalu disalin ke kedua penyimpanan.
 * Bila data browser dihapus, ID berubah dan admin perlu "Reset Device".
 */
export function getDeviceId(): Promise<string> {
  pending ??= (async () => {
    const local = readLocal();
    if (local) {
      void writeBackup(local);
      return local;
    }
    const backup = await readBackup();
    const id = backup ?? crypto.randomUUID();
    writeLocal(id);
    if (!backup) await writeBackup(id);
    return id;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
