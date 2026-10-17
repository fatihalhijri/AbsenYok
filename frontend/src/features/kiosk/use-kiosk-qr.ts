'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '@/lib/error';
import { clockOffset, qrRefreshDelay } from '@/lib/qr-schedule';
import type { KioskQr } from '@/types';
import { kioskApi } from './api';
import { backoffDelay, KIOSK_QR_LEAD_MS } from './schedule';

export type KioskConnection =
  /** Belum pernah berhasil memuat token. */
  | 'connecting'
  | 'live'
  /** Gagal memuat — QR disembunyikan, mencoba lagi dengan backoff. */
  | 'reconnecting'
  /** Kiosk tidak ada / nonaktif / ID salah — QR disembunyikan, tetap dicoba ulang berkala. */
  | 'unavailable'
  /** Sesi ditolak server (refresh gagal) — ditangani layar "Sesi kiosk berakhir". */
  | 'unauthorized';

export interface KioskQrState {
  qr: KioskQr | null;
  /** Selisih jam server − perangkat (ms). */
  offsetMs: number;
  connection: KioskConnection;
  /** Jumlah gagal berturut-turut. */
  failures: number;
  /** Jam perangkat (epoch ms) percobaan berikutnya saat `reconnecting`/`unavailable`. */
  retryAt: number | null;
  /** Pesan server saat `unavailable`. */
  message: string | null;
}

interface Options {
  fetchQr?: (id: string) => Promise<KioskQr>;
}

/**
 * Penjadwal token QR kiosk:
 * - sukses → token berikutnya diminta `expiresAt − 1 dtk` dan saat jendela berganti
 *   (dikoreksi offset jam server);
 * - gagal → `reconnecting` (QR disembunyikan pemanggil), coba lagi 2, 4, 8, 16, 30… dtk;
 * - `offline` → langsung `reconnecting`; `online`/tab terlihat lagi → coba segera.
 */
export function useKioskQr(kioskId: string, { fetchQr = kioskApi.qr }: Options = {}) {
  const [state, setState] = useState<KioskQrState>({
    qr: null,
    offsetMs: 0,
    connection: 'connecting',
    failures: 0,
    retryAt: null,
    message: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const failures = useRef(0);
  const disposed = useRef(false);
  const fetchRef = useRef(fetchQr);
  // Rantai penjadwalan memanggil versi terbaru `load` lewat ref (tanpa rekursi di useCallback).
  const loadRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    fetchRef.current = fetchQr;
  });

  const schedule = useCallback((delay: number, run: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, delay);
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current || disposed.current) return;
    inFlight.current = true;
    try {
      const qr = await fetchRef.current(kioskId);
      if (disposed.current) return;
      const receivedAt = Date.now();
      failures.current = 0;
      setState({
        qr,
        offsetMs: clockOffset(qr, receivedAt),
        connection: 'live',
        failures: 0,
        retryAt: null,
        message: null,
      });
      schedule(
        qrRefreshDelay(qr, receivedAt, Date.now(), { leadMs: KIOSK_QR_LEAD_MS }),
        () => void loadRef.current(),
      );
    } catch (error) {
      if (disposed.current) return;
      const apiError = toApiError(error);
      if (apiError.isAuthRejection) {
        setState((current) => ({ ...current, connection: 'unauthorized', retryAt: null }));
        return;
      }
      // 400 (ID tidak valid), 404 (kiosk dihapus), 422 KIOSK_INACTIVE: bukan gangguan jaringan.
      const unavailable = [400, 404, 422].includes(apiError.status);
      failures.current += 1;
      const delay = backoffDelay(failures.current);
      setState((current) => ({
        ...current,
        connection: unavailable ? 'unavailable' : 'reconnecting',
        failures: failures.current,
        retryAt: Date.now() + delay,
        message: unavailable ? apiError.message : null,
      }));
      schedule(delay, () => void loadRef.current());
    } finally {
      inFlight.current = false;
    }
  }, [kioskId, schedule]);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  /** Coba sekarang (mis. permintaan lain gagal / koneksi kembali). */
  const checkNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void load();
  }, [load]);

  useEffect(() => {
    disposed.current = false;
    void load();

    const onOffline = () => {
      if (timer.current) clearTimeout(timer.current);
      failures.current = Math.max(failures.current, 1);
      setState((current) => ({
        ...current,
        connection: current.connection === 'unauthorized' ? 'unauthorized' : 'reconnecting',
        failures: failures.current,
        retryAt: null,
      }));
    };
    const onOnline = () => checkNow();
    // Timer bisa sangat diperlambat saat tab tersembunyi → segarkan begitu terlihat lagi.
    const onVisible = () => document.visibilityState === 'visible' && checkNow();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed.current = true;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, checkNow]);

  return { ...state, checkNow };
}
