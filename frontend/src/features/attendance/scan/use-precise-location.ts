'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GeoError, type Position, watchPosition } from '@/lib/geolocation';

/** Posisi lebih tua dari ini boleh digantikan posisi baru walau akurasinya lebih buruk. */
const STALE_AFTER_MS = 15_000;

export type LocationStatus = 'locating' | 'ready' | 'error';

export interface PreciseLocation {
  status: LocationStatus;
  /** Posisi terbaik saat ini (akurasi terkecil di antara posisi yang masih segar). */
  position: Position | null;
  error: GeoError | null;
  /** Posisi terbaik yang ada, atau tunggu posisi pertama maksimal `timeoutMs`. */
  waitForFix: (timeoutMs?: number) => Promise<Position>;
  /** Buang posisi lama & mulai ulang pemantauan (mis. setelah pindah tempat). */
  refresh: () => void;
}

/** Pilih posisi yang dipertahankan: akurasi lebih baik, atau posisi lama sudah basi. */
export function pickBetter(current: Position | null, next: Position): Position {
  if (!current) return next;
  if (next.accuracy <= current.accuracy) return next;
  return next.timestamp - current.timestamp > STALE_AFTER_MS ? next : current;
}

/**
 * Mulai `watchPosition` (akurasi tinggi) segera saat dipasang — berjalan paralel dengan kamera
 * sehingga koordinat sudah siap ketika QR terbaca. Pemantauan berhenti saat unmount.
 */
export function usePreciseLocation(): PreciseLocation {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [session, setSession] = useState(0);
  const bestRef = useRef<Position | null>(null);
  const waitersRef = useRef(new Set<(position: Position) => void>());

  useEffect(() => {
    bestRef.current = null;
    return watchPosition(
      (next) => {
        const best = pickBetter(bestRef.current, next);
        bestRef.current = best;
        setPosition(best);
        setError(null);
        waitersRef.current.forEach((resolve) => resolve(best));
        waitersRef.current.clear();
      },
      // Error saat sudah punya posisi (mis. timeout sesaat) tidak menggugurkan posisi yang ada.
      (nextError) => {
        if (!bestRef.current || nextError.code === 'PERMISSION_DENIED') setError(nextError);
      },
    );
  }, [session]);

  const waitForFix = useCallback((timeoutMs = 8_000) => {
    if (bestRef.current) return Promise.resolve(bestRef.current);
    return new Promise<Position>((resolve, reject) => {
      const done = (value: Position) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        waitersRef.current.delete(done);
        reject(new GeoError('TIMEOUT'));
      }, timeoutMs);
      waitersRef.current.add(done);
    });
  }, []);

  const refresh = useCallback(() => {
    bestRef.current = null;
    setPosition(null);
    setError(null);
    setSession((value) => value + 1);
  }, []);

  const status: LocationStatus = position ? 'ready' : error ? 'error' : 'locating';
  return { status, position, error, waitForFix, refresh };
}
