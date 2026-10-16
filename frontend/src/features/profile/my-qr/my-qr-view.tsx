'use client';

import { MonitorSmartphoneIcon, SunIcon, WifiOffIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ErrorState } from '@/components/shared/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { useWakeLock, type WakeLockStatus } from '@/hooks/use-wake-lock';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useMyQr } from '../hooks';

/** QR personal (mode cadangan) — dipindai petugas bila kiosk tidak tersedia. */
export function MyQrView() {
  const user = useAuthStore((state) => state.user);
  const qr = useMyQr();
  const wakeLock = useWakeLock();

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">QR Personal</h1>
        <p className="text-sm text-muted-foreground">
          Tunjukkan QR ini ke petugas jika kiosk tidak tersedia.
        </p>
      </div>

      {qr.data ? (
        <>
          {/* QR selalu hitam-di-atas-putih (juga di tema gelap) agar mudah dipindai. */}
          <figure className="w-full max-w-[340px] rounded-3xl border bg-white p-5 text-neutral-900 shadow-md">
            <QRCodeSVG
              value={qr.data.token}
              size={300}
              level="M"
              marginSize={2}
              title="QR personal absensi"
              className="mx-auto h-auto w-full max-w-[300px] min-w-[260px]"
              data-token-window={qr.data.token.split('.')[3]}
            />
            <figcaption className="mt-4 space-y-0.5">
              <p className="text-lg font-semibold">{user?.name}</p>
              <p className="text-sm text-neutral-600 tabular-nums">NIP {user?.employeeCode}</p>
            </figcaption>
          </figure>
          <QrCountdown
            expiresAt={qr.data.expiresAt}
            intervalSeconds={qr.data.intervalSeconds}
            offsetMs={qr.offsetMs}
            failing={qr.isError}
          />
        </>
      ) : qr.isError ? (
        <ErrorState
          className="w-full rounded-2xl border"
          message={getErrorMessage(qr.error)}
          onRetry={() => void qr.refetch()}
        />
      ) : (
        <Skeleton className="aspect-square w-full max-w-[340px] rounded-3xl" />
      )}

      <ul className="w-full space-y-2 text-left text-sm">
        <Tip icon={SunIcon}>Naikkan kecerahan layar agar QR mudah dipindai.</Tip>
        <Tip icon={MonitorSmartphoneIcon}>{WAKE_LOCK_TEXT[wakeLock]}</Tip>
      </ul>
    </div>
  );
}

const WAKE_LOCK_TEXT: Record<WakeLockStatus, string> = {
  active: 'Layar dijaga tetap menyala selama halaman ini terbuka.',
  pending: 'Menjaga layar tetap menyala…',
  released: 'Layar dapat mati otomatis — sentuh layar sesekali.',
  error: 'Layar tidak dapat dijaga menyala (mis. mode hemat baterai) — sentuh layar sesekali.',
  unsupported: 'Browser ini tidak dapat menjaga layar tetap menyala — sentuh layar sesekali.',
};

function Tip({ icon: Icon, children }: { icon: typeof SunIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

const RING_SIZE = 56;
const RING_STROKE = 5;

/**
 * Hitung mundur berbentuk cincin. Hanya komponen ini yang berdetak (useNow) — QR di atasnya
 * tidak dirender ulang tiap detik.
 */
function QrCountdown({
  expiresAt,
  intervalSeconds,
  offsetMs,
  failing,
}: {
  expiresAt: string;
  intervalSeconds: number;
  offsetMs: number;
  failing: boolean;
}) {
  const now = useNow(250);
  const remainingMs = now === null ? null : Date.parse(expiresAt) - (now + offsetMs);
  const seconds = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction =
    remainingMs === null ? 1 : Math.min(1, Math.max(0, remainingMs / (intervalSeconds * 1000)));
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const expired = seconds === 0;

  return (
    <div className="flex items-center gap-3" aria-live="off">
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            className="stroke-muted"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className={cn(
              'transition-[stroke-dashoffset] duration-300 ease-linear',
              fraction < 0.2 ? 'stroke-warning' : 'stroke-primary',
            )}
          />
        </svg>
        <span
          role="timer"
          className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums"
        >
          {seconds ?? '–'}
        </span>
      </div>
      <p className="text-left text-sm text-muted-foreground">
        {failing && expired ? (
          <span className="flex items-center gap-1.5 text-destructive">
            <WifiOffIcon className="size-4" aria-hidden="true" />
            Gagal memperbarui QR — periksa koneksi.
          </span>
        ) : (
          <>
            QR berganti otomatis
            <br />
            setiap {intervalSeconds} detik
          </>
        )}
      </p>
    </div>
  );
}
