/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist';

// Nilai `self.__SW_MANIFEST` diganti daftar precache saat service worker di-bundle.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY_SECONDS = 24 * 60 * 60;

/** Data publik yang jarang berubah: boleh tampil dari cache sambil diperbarui di belakang. */
const STALE_WHILE_REVALIDATE_PATHS = new Set(['/api/v1/holidays', '/api/v1/settings/public']);

/**
 * Urutan penting — aturan pertama yang cocok yang dipakai.
 * Data absensi & semua API lain TIDAK BOLEH di-cache (NetworkOnly), selain dua endpoint publik di atas.
 */
const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && STALE_WHILE_REVALIDATE_PATHS.has(url.pathname),
    handler: new StaleWhileRevalidate({
      cacheName: 'api-public',
      plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 7 * DAY_SECONDS })],
    }),
  },
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request }) => request.destination === 'font',
    handler: new CacheFirst({
      cacheName: 'fonts',
      plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * DAY_SECONDS })],
    }),
  },
  {
    // Gambar & ikon (termasuk /icons, /uploads/avatars, /_next/image).
    matcher: ({ request }) => request.destination === 'image',
    handler: new CacheFirst({
      cacheName: 'images',
      plugins: [new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * DAY_SECONDS })],
    }),
  },
  // Aset & halaman Next.js lainnya: strategi bawaan Serwist.
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        // Navigasi halaman saat offline (atau server tidak terjangkau) → halaman /offline.
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
