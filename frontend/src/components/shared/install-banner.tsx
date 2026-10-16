'use client';

import { DownloadIcon, ShareIcon, SquarePlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalFlag } from '@/hooks/use-local-flag';
import { useInstallPrompt } from '@/lib/install-prompt';

const DISMISSED_KEY = 'ay-install-banner-dismissed';

/**
 * Ajakan memasang PWA. Android/desktop: tombol "Pasang" memakai `beforeinstallprompt`.
 * iOS (tanpa API instal): instruksi Bagikan → Tambahkan ke Layar Utama. Bisa ditutup & diingat.
 */
export function InstallBanner() {
  const [dismissed, setDismissed] = useLocalFlag(DISMISSED_KEY);
  const { platform, canPrompt, install } = useInstallPrompt();

  if (dismissed || platform === 'installed') return null;
  if (platform === 'other' && !canPrompt) return null;

  const onInstall = async () => {
    if ((await install()) === 'accepted') setDismissed(true);
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
            <Button size="sm" className="min-h-9" onClick={() => void onInstall()}>
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
