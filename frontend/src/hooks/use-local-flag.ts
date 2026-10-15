import { useCallback, useSyncExternalStore } from 'react';

const EVENT = 'absenyok:local-flag';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false; // mode privat / storage diblokir
  }
}

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(EVENT, listener);
  };
}

/**
 * Penanda boolean di localStorage (mis. "banner sudah ditutup"). Saat prerender bernilai
 * `serverValue` agar tidak terjadi hydration mismatch.
 */
export function useLocalFlag(key: string, serverValue = true): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => serverValue,
  );
  const setValue = useCallback(
    (next: boolean) => {
      try {
        if (next) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
      } catch {
        // abaikan — preferensi hanya tidak tersimpan
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, setValue];
}
