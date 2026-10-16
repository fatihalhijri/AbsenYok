'use client';

import { useEffect, useState } from 'react';

export type WakeLockStatus = 'unsupported' | 'pending' | 'active' | 'released' | 'error';

/**
 * Jaga layar tetap menyala (Screen Wake Lock API) selama komponen terpasang.
 * Browser otomatis melepas lock saat tab disembunyikan → diminta ulang saat terlihat lagi.
 * Lock dilepas saat unmount (keluar halaman).
 */
export function useWakeLock(enabled = true): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>('pending');

  useEffect(() => {
    if (!enabled) return;
    if (!('wakeLock' in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi fitur browser sekali saat mount
      setStatus('unsupported');
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const onRelease = () => {
      if (!disposed) setStatus('released');
    };

    const request = async () => {
      if (disposed || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) {
        return;
      }
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) {
          await lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', onRelease);
        setStatus('active');
      } catch {
        // Mis. hemat baterai aktif / kebijakan izin — halaman tetap berfungsi.
        if (!disposed) setStatus('error');
      }
    };

    const onVisibility = () => void request();
    document.addEventListener('visibilitychange', onVisibility);
    void request();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const lock = sentinel;
      sentinel = null;
      if (lock && !lock.released) {
        lock.removeEventListener('release', onRelease);
        void lock.release();
      }
    };
  }, [enabled]);

  return enabled ? status : 'released';
}
