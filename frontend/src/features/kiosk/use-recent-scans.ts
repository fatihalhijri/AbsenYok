'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { RecentScan } from '@/types';
import { kioskApi, kioskKeys } from './api';
import { newScanIds, RECENT_SCANS_INTERVAL_MS } from './schedule';

/** Lama sorotan entri baru (ms). */
export const HIGHLIGHT_MS = 6_000;

interface Options {
  /** Polling hanya saat koneksi QR sehat. */
  enabled: boolean;
  /** Dipanggil saat polling gagal (memicu pengecekan koneksi). */
  onError?: () => void;
  /** Dipanggil sekali per batch entri baru (mis. bunyi "ding"). */
  onNew?: (ids: string[]) => void;
}

/** "Baru saja absen": polling tiap 5 dtk, menandai entri baru untuk animasi & sorotan. */
export function useRecentScans(kioskId: string, { enabled, onError, onNew }: Options) {
  const query = useQuery({
    queryKey: kioskKeys.recentScans(kioskId),
    queryFn: () => kioskApi.recentScans(kioskId),
    enabled,
    refetchInterval: enabled ? RECENT_SCANS_INTERVAL_MS : false,
    refetchIntervalInBackground: true, // layar kiosk tetap diperbarui walau jendela tidak fokus
    retry: false,
    gcTime: 60_000,
  });
  const previous = useRef<RecentScan[] | null>(null);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const callbacks = useRef({ onError, onNew });
  useEffect(() => {
    callbacks.current = { onError, onNew };
  });

  useEffect(() => {
    if (query.isError) callbacks.current.onError?.();
  }, [query.isError, query.errorUpdatedAt]);

  useEffect(() => {
    const items = query.data;
    if (!items) return;
    const fresh = newScanIds(previous.current, items);
    previous.current = items;
    if (fresh.length === 0) return;
    callbacks.current.onNew?.(fresh);
    setHighlighted((current) => new Set([...current, ...fresh]));
    // Timer per batch (bukan cleanup effect) agar data baru tidak membatalkan sorotan sebelumnya.
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setHighlighted((current) => {
        const next = new Set(current);
        fresh.forEach((id) => next.delete(id));
        return next;
      });
    }, HIGHLIGHT_MS);
    timers.current.add(timer);
  }, [query.data]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { items: query.data ?? [], loading: query.isPending && enabled, highlighted };
}
