import { useSyncExternalStore } from 'react';

interface Ticker {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Satu timer per interval dibagi semua komponen (mis. semua jam per-detik berdetak bersamaan). */
const tickers = new Map<number, Ticker>();

function tickerFor(intervalMs: number): Ticker {
  let ticker = tickers.get(intervalMs);
  if (!ticker) {
    ticker = { now: Date.now(), listeners: new Set(), timer: null };
    tickers.set(intervalMs, ticker);
  }
  return ticker;
}

function schedule(intervalMs: number, ticker: Ticker) {
  // Selaraskan ke batas interval (mis. tepat pergantian detik) agar jam tidak "meloncat".
  const delay = intervalMs - (Date.now() % intervalMs) || intervalMs;
  ticker.timer = setTimeout(() => {
    ticker.now = Date.now();
    ticker.listeners.forEach((listener) => listener());
    schedule(intervalMs, ticker);
  }, delay);
}

function subscribeFor(intervalMs: number) {
  return (listener: () => void) => {
    const ticker = tickerFor(intervalMs);
    ticker.listeners.add(listener);
    if (ticker.timer === null) {
      ticker.now = Date.now();
      schedule(intervalMs, ticker);
    }
    return () => {
      ticker.listeners.delete(listener);
      if (ticker.listeners.size === 0 && ticker.timer !== null) {
        clearTimeout(ticker.timer);
        ticker.timer = null;
      }
    };
  };
}

const subscribers = new Map<number, (listener: () => void) => () => void>();
const getSubscriber = (intervalMs: number) => {
  let subscribe = subscribers.get(intervalMs);
  if (!subscribe) {
    subscribe = subscribeFor(intervalMs);
    subscribers.set(intervalMs, subscribe);
  }
  return subscribe;
};

const getServerSnapshot = () => null;

/**
 * Waktu sekarang (epoch ms) yang diperbarui tiap `intervalMs`; `null` saat prerender/SSR.
 * Pakai HANYA di komponen kecil (jam/hitung mundur) agar detik berjalan tidak me-render ulang
 * seluruh halaman.
 */
export function useNow(intervalMs = 1000): number | null {
  return useSyncExternalStore(
    getSubscriber(intervalMs),
    () => tickerFor(intervalMs).now,
    getServerSnapshot,
  );
}
