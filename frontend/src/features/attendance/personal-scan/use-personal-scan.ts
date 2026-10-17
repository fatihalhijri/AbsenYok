'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from '@/lib/error';
import { beep, vibrate, VIBRATE_ERROR, VIBRATE_SUCCESS } from '@/lib/feedback';
import { GeoError, type Position } from '@/lib/geolocation';
import type { PersonalScanInput, ScanResult } from '@/types';
import { isPersonalQr } from '../scan/scan-errors';
import { FIRST_FIX_TIMEOUT_MS, type ScanOutcome, type ScanPhase } from '../scan/use-scan-flow';

/** Hasil tampil selama ini sebelum pemindai aktif lagi (mode scan beruntun). */
export const REARM_DELAY_MS = 2_000;

/**
 * Token yang sama diabaikan selama ini — QR personal berlaku ±60 dtk dan karyawan biasanya
 * masih menyodorkan HP saat pemindai aktif lagi (mencegah hasil "QR sudah dipakai" palsu).
 */
export const DUPLICATE_WINDOW_MS = 90_000;

/**
 * Token yang gagal (mis. petugas di luar area) baru dipindai ulang otomatis setelah jeda ini —
 * tanpa jeda, HP karyawan yang masih tersodor memicu error berulang tiap 2 detik.
 * Tombol "Scan ulang" langsung mengizinkan token itu lagi.
 */
export const ERROR_RETRY_MS = 8_000;

/** Maksimal hasil yang disimpan di daftar sesi. */
export const SESSION_LIMIT = 50;

export interface SessionEntry {
  id: number;
  at: Date;
  outcome: ScanOutcome;
}

interface PersonalScanOptions {
  /** Lokasi absen yang dipilih petugas (`null` → scan diabaikan). */
  locationId: string | null;
  waitForFix: (timeoutMs: number) => Promise<Position>;
  submit: (input: PersonalScanInput) => Promise<ScanResult>;
  /** Mode beruntun: aktif lagi otomatis setelah `REARM_DELAY_MS`. */
  continuous: boolean;
  now?: () => number;
}

const geoToApiError = (error: GeoError) =>
  new ApiError({ code: `GEO_${error.code}`, message: error.message, status: 0 });

/**
 * Alur scan QR personal oleh petugas: QR terbaca → kunci (1 QR = 1 request) → posisi petugas →
 * `POST /attendance/personal-scan` → hasil + catat di daftar sesi → (beruntun) aktif lagi 2 dtk.
 */
export function usePersonalScan({
  locationId,
  waitForFix,
  submit,
  continuous,
  now = Date.now,
}: PersonalScanOptions) {
  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [session, setSession] = useState<SessionEntry[]>([]);
  const lockRef = useRef(false);
  const seenRef = useRef(new Map<string, number>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const lastErrorTokenRef = useRef<string | null>(null);
  const continuousRef = useRef(continuous);
  useEffect(() => {
    continuousRef.current = continuous;
  });

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    lockRef.current = false;
    setOutcome(null);
    setPhase('scanning');
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const finish = useCallback(
    (next: ScanOutcome) => {
      vibrate(next.kind === 'success' ? VIBRATE_SUCCESS : VIBRATE_ERROR);
      setOutcome(next);
      setPhase('result');
      seqRef.current += 1;
      const entry: SessionEntry = { id: seqRef.current, at: new Date(now()), outcome: next };
      setSession((current) => [entry, ...current].slice(0, SESSION_LIMIT));
      if (continuousRef.current) timerRef.current = setTimeout(reset, REARM_DELAY_MS);
    },
    [now, reset],
  );

  /** Token gagal kedaluwarsa dari daftar "sudah dipindai" setelah `ERROR_RETRY_MS`. */
  const coolDown = useCallback((token: string, at: number) => {
    seenRef.current.set(token, at - DUPLICATE_WINDOW_MS + ERROR_RETRY_MS);
    lastErrorTokenRef.current = token;
  }, []);

  /** "Scan ulang" setelah gagal: token terakhir yang gagal boleh langsung dipindai lagi. */
  const retry = useCallback(() => {
    if (lastErrorTokenRef.current) seenRef.current.delete(lastErrorTokenRef.current);
    lastErrorTokenRef.current = null;
    reset();
  }, [reset]);

  const handleDecode = useCallback(
    async (qrToken: string) => {
      if (lockRef.current || !locationId || !isPersonalQr(qrToken)) return;
      const token = qrToken.trim();
      const at = now();
      for (const [seen, time] of seenRef.current) {
        if (at - time >= DUPLICATE_WINDOW_MS) seenRef.current.delete(seen);
      }
      if (seenRef.current.has(token)) return;
      seenRef.current.set(token, at);

      lockRef.current = true;
      setPhase('processing');
      beep();

      let position: Position;
      try {
        position = await waitForFix(FIRST_FIX_TIMEOUT_MS);
      } catch (error) {
        // Gagal karena lokasi petugas → token boleh dicoba lagi (setelah jeda / Scan ulang).
        coolDown(token, at);
        finish({
          kind: 'error',
          error: error instanceof GeoError ? geoToApiError(error) : toApiError(error),
        });
        return;
      }

      try {
        const result = await submit({
          qrToken: token,
          locationId,
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        });
        finish({ kind: 'success', result });
      } catch (error) {
        const apiError = toApiError(error);
        // Server melepas token bila scan gagal (kecuali sudah dipakai) → boleh dicoba lagi.
        if (apiError.code !== 'QR_ALREADY_USED') coolDown(token, at);
        finish({ kind: 'error', error: apiError });
      }
    },
    [coolDown, finish, locationId, now, submit, waitForFix],
  );

  const clearSession = useCallback(() => setSession([]), []);

  return { phase, outcome, session, handleDecode, reset, retry, clearSession };
}
