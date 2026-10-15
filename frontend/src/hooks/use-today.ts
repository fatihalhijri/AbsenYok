import { useSyncExternalStore } from 'react';
import { todayString } from '@/lib/date';

const MINUTE_MS = 60_000;

/** Cek pergantian tanggal tiap menit (aplikasi PWA bisa terbuka melewati tengah malam). */
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, MINUTE_MS);
  return () => clearInterval(timer);
}

/** Saat prerender/SSR waktu tidak boleh dibaca (Cache Components) → `null`, diisi setelah hydration. */
const getServerSnapshot = () => null;

/**
 * Tanggal hari ini (`YYYY-MM-DD`, zona APP_TIMEZONE) di browser; `null` saat prerender.
 * Komponen yang bergantung pada tanggal menampilkan skeleton selama nilainya `null`.
 */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, todayString, getServerSnapshot);
}
