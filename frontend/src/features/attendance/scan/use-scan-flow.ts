'use client';

import { useCallback, useRef, useState } from 'react';
import { getDeviceId as defaultGetDeviceId } from '@/lib/device-id';
import { ApiError, toApiError } from '@/lib/error';
import { beep, vibrate, VIBRATE_ERROR, VIBRATE_SUCCESS } from '@/lib/feedback';
import { GeoError, type Position } from '@/lib/geolocation';
import type { ScanKioskInput, ScanResult } from '@/types';
import { isKioskQr } from './scan-errors';

/** Batas tunggu posisi pertama sebelum mengirim scan. */
export const FIRST_FIX_TIMEOUT_MS = 8_000;

export type ScanPhase = 'scanning' | 'processing' | 'result';
export type ScanOutcome =
  { kind: 'success'; result: ScanResult } | { kind: 'error'; error: ApiError };

interface ScanFlowOptions {
  waitForFix: (timeoutMs: number) => Promise<Position>;
  submit: (input: ScanKioskInput) => Promise<ScanResult>;
  getDeviceId?: () => Promise<string>;
}

const geoToApiError = (error: GeoError) =>
  new ApiError({ code: `GEO_${error.code}`, message: error.message, status: 0 });

/**
 * Alur scan kiosk: QR terbaca → kunci (1 QR = 1 request) → tunggu posisi (maks 8 dtk) →
 * `POST /attendance/scan` → hasil. Kunci baru dilepas lewat `reset()` (tombol "Scan Ulang").
 */
export function useScanFlow({
  waitForFix,
  submit,
  getDeviceId = defaultGetDeviceId,
}: ScanFlowOptions) {
  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const lockRef = useRef(false);

  const fail = useCallback((error: ApiError) => {
    vibrate(VIBRATE_ERROR);
    setOutcome({ kind: 'error', error });
    setPhase('result');
  }, []);

  const handleDecode = useCallback(
    async (qrToken: string) => {
      // Pertahanan berlapis: QR non-kiosk tidak pernah dikirim, dan hanya satu proses berjalan.
      if (lockRef.current || !isKioskQr(qrToken)) return;
      lockRef.current = true;
      setPhase('processing');
      vibrate(VIBRATE_SUCCESS);
      beep();

      let position: Position;
      try {
        position = await waitForFix(FIRST_FIX_TIMEOUT_MS);
      } catch (error) {
        fail(error instanceof GeoError ? geoToApiError(error) : toApiError(error));
        return;
      }

      try {
        const deviceId = await getDeviceId();
        const result = await submit({
          qrToken,
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          deviceId,
        });
        setOutcome({ kind: 'success', result });
        setPhase('result');
      } catch (error) {
        fail(toApiError(error));
      }
    },
    [fail, getDeviceId, submit, waitForFix],
  );

  const reset = useCallback(() => {
    lockRef.current = false;
    setOutcome(null);
    setPhase('scanning');
  }, []);

  return { phase, outcome, handleDecode, reset };
}
