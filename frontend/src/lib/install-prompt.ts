import { useSyncExternalStore } from 'react';

/** Event Chrome/Edge/Android sebelum prompt instal (tidak ada di tipe DOM standar). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'installed' | 'ios' | 'other';

/*
 * `beforeinstallprompt` hanya dikirim SEKALI per muat halaman — ditangkap di level modul agar
 * bisa dipakai banner beranda maupun menu profil, apa pun halaman yang sedang dibuka.
 */
let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // tampilkan ajakan sendiri, bukan mini-infobar bawaan
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

function detectPlatform(): InstallPlatform {
  const standalone =
    installedNow ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  const ua = navigator.userAgent;
  // iPadOS 13+ mengaku "Macintosh" — cek dukungan sentuh.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'other';
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Status instal PWA: `platform` (saat prerender dianggap `installed` → tidak tampil),
 * `canPrompt` bila browser menyediakan prompt instal, dan `install()` untuk memicunya.
 */
export function useInstallPrompt() {
  const platform = useSyncExternalStore<InstallPlatform>(
    subscribe,
    detectPlatform,
    () => 'installed',
  );
  const canPrompt = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const event = deferred;
    if (!event) return 'unavailable';
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null; // event hanya bisa dipakai sekali
    emit();
    return outcome;
  };

  return { platform, canPrompt, install };
}
