'use client';

import { MapPinIcon, MonitorSmartphoneIcon, MonitorXIcon } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocalFlag } from '@/hooks/use-local-flag';
import { useNow } from '@/hooks/use-now';
import { useWakeLock, type WakeLockStatus } from '@/hooks/use-wake-lock';
import { ding } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { FULL_RELOAD_MS } from '../schedule';
import { useKioskQr } from '../use-kiosk-qr';
import { useRecentScans } from '../use-recent-scans';
import { KioskClock } from './kiosk-clock';
import { KioskControls, useIdle } from './kiosk-controls';
import { KioskQr } from './kiosk-qr';
import { ConnectionOverlay, SessionEndedScreen } from './kiosk-status-screens';
import { RecentScansList } from './recent-scans-list';

const MUTED_KEY = 'ay-kiosk-muted';

/** Layar kiosk `/kiosk/[kioskId]`: QR dinamis (kiri) + jam & "Baru saja absen" (kanan). */
export function KioskView() {
  const { kioskId } = useParams<{ kioskId: string }>();
  const pathname = usePathname();
  const qr = useKioskQr(kioskId);
  const wakeLock = useWakeLock();
  const idle = useIdle();
  const [muted, setMuted] = useLocalFlag(MUTED_KEY, false);
  useScheduledReload();

  const live = qr.connection === 'live' && qr.qr !== null;
  const onNew = useCallback(() => {
    if (!muted) ding();
  }, [muted]);
  const recent = useRecentScans(kioskId, { enabled: live, onError: qr.checkNow, onNew });

  if (qr.connection === 'unauthorized') return <SessionEndedScreen nextPath={pathname} />;

  return (
    <div
      data-connection={qr.connection}
      className={cn(
        'grid min-h-dvh gap-6 p-6 lg:gap-10 lg:p-10',
        'grid-rows-[auto_1fr] landscape:grid-cols-[3fr_2fr] landscape:grid-rows-1',
        idle && 'cursor-none',
      )}
    >
      <KioskControls idle={idle} soundOn={!muted} onToggleSound={() => setMuted(!muted)} />

      <main className="flex min-h-0 items-center justify-center">
        {live && qr.qr ? (
          <KioskQr qr={qr.qr} offsetMs={qr.offsetMs} />
        ) : qr.connection === 'connecting' ? (
          <Skeleton className="aspect-square h-[min(70dvh,82vw)] rounded-[2rem] bg-white/10" />
        ) : qr.connection === 'unavailable' ? (
          <UnavailablePanel message={qr.message} retryAt={qr.retryAt} />
        ) : (
          <ConnectionOverlay retryAt={qr.retryAt} className="w-full max-w-2xl" />
        )}
      </main>

      <aside className="flex min-h-0 flex-col gap-6 landscape:border-l landscape:border-white/10 landscape:pl-10">
        <KioskClock offsetMs={qr.offsetMs} />
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-2xl font-semibold">
            <MonitorSmartphoneIcon className="size-6 text-primary" aria-hidden="true" />
            {qr.qr?.kiosk.name ?? 'Kiosk'}
          </p>
          {qr.qr ? (
            <p className="flex items-center gap-2 text-lg text-muted-foreground">
              <MapPinIcon className="size-5" aria-hidden="true" />
              {qr.qr.kiosk.locationName}
            </p>
          ) : null}
        </div>
        <RecentScansList
          items={recent.items}
          highlighted={recent.highlighted}
          loading={recent.loading}
        />
        <p className="text-xs text-muted-foreground" data-testid="wake-lock-status">
          {WAKE_LOCK_TEXT[wakeLock]}
        </p>
      </aside>
    </div>
  );
}

const WAKE_LOCK_TEXT: Record<WakeLockStatus, string> = {
  active: 'Layar dijaga tetap menyala.',
  pending: 'Menjaga layar tetap menyala…',
  released: 'Layar dapat mati otomatis — atur "jangan pernah tidur" di perangkat.',
  error: 'Layar tidak dapat dijaga menyala — atur "jangan pernah tidur" di perangkat.',
  unsupported: 'Browser ini tidak mendukung Wake Lock — atur "jangan pernah tidur" di perangkat.',
};

/** Kiosk dihapus / dinonaktifkan / ID salah. Tetap dicoba ulang berkala agar pulih sendiri. */
function UnavailablePanel({
  message,
  retryAt,
}: {
  message: string | null;
  retryAt: number | null;
}) {
  const now = useNow(1000);
  const seconds = retryAt !== null && now !== null ? Math.ceil((retryAt - now) / 1000) : null;
  return (
    <div
      role="alert"
      data-testid="kiosk-unavailable"
      className="flex max-w-2xl flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-10 text-center"
    >
      <MonitorXIcon className="size-16 text-muted-foreground" aria-hidden="true" />
      <p className="text-3xl font-semibold">Kiosk tidak tersedia</p>
      <p className="text-lg text-muted-foreground">
        {message ?? 'Kiosk tidak ditemukan atau sedang dinonaktifkan.'} Hubungi admin.
      </p>
      {seconds !== null && seconds > 0 ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          Memeriksa lagi dalam {seconds} detik
        </p>
      ) : null}
    </div>
  );
}

/** Muat ulang halaman penuh tiap 6 jam (menunggu online bila jaringan sedang putus). */
function useScheduledReload() {
  useEffect(() => {
    let onOnline: (() => void) | null = null;
    const timer = setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
        return;
      }
      onOnline = () => window.location.reload();
      window.addEventListener('online', onOnline, { once: true });
    }, FULL_RELOAD_MS);
    return () => {
      clearTimeout(timer);
      if (onOnline) window.removeEventListener('online', onOnline);
    };
  }, []);
}
