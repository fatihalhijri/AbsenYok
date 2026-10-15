'use client';

import { DownloadIcon, ShareIcon, SquarePlusIcon, XIcon } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { useLocalFlag } from '@/hooks/use-local-flag';

const DISMISSED_KEY = 'ay-install-banner-dismissed';

/** Event Chrome/Edge/Android sebelum menampilkan prompt instal (tidak ada di tipe DOM standar). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'installed' | 'ios' | 'other';

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  const ua = navigator.userAgent;
  // iPadOS 13+ mengaku "Macintosh" — cek dukungan sentuh.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'other';
}

const noopSubscribe = () => () => undefined;

/**
 * Ajakan memasang PWA. Android/desktop: tombol "Pasang" memakai `beforeinstallprompt`.
 * iOS (tanpa API instal): instruksi Bagikan → Tambahkan ke Layar Utama. Bisa ditutup & diingat.
 */
export function InstallBanner() {
  const [dismissed, setDismissed] = useLocalFlag(DISMISSED_KEY);
  // Saat prerender dianggap "installed" (tidak tampil) — dihitung ulang di browser.
  const platform = useSyncExternalStore<Platform>(noopSubscribe, detectPlatform, () => 'installed');
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // tampilkan banner sendiri, bukan mini-infobar bawaan
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || platform === 'installed') return null;
  if (platform === 'other' && !installEvent) return null;

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'accepted') setDismissed(true);
  };

  return (
    <aside
      aria-label="Pasang aplikasi"
      className="relative flex items-start gap-3 rounded-2xl border border-primary/30 bg-accent p-4 pr-12 text-accent-foreground"
    >
      <DownloadIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-2 text-sm">
        <p className="font-semibold">Pasang AbsenYok di HP Anda</p>
        {platform === 'ios' ? (
          <p>
            Ketuk <ShareIcon className="inline size-4 align-text-bottom" aria-label="Bagikan" />{' '}
            lalu pilih{' '}
            <span className="font-medium">
              Tambahkan ke Layar Utama{' '}
              <SquarePlusIcon className="inline size-4 align-text-bottom" aria-hidden="true" />
            </span>
            .
          </p>
        ) : (
          <>
            <p>Buka lebih cepat langsung dari layar utama, seperti aplikasi biasa.</p>
            <Button size="sm" className="min-h-9" onClick={() => void install()}>
              Pasang
            </Button>
          </>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-10"
        aria-label="Tutup ajakan pasang aplikasi"
        onClick={() => setDismissed(true)}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </aside>
  );
}
