'use client';

import { CameraOffIcon, Loader2Icon, QrCodeIcon, ShieldAlertIcon, WifiOffIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnline } from '@/hooks/use-online';
import { useScanAttendance } from '../hooks';
import {
  type CheckState,
  PermissionChecklist,
  PermissionGuide,
  PermissionNotes,
} from './permission-checklist';
import type { CameraState } from './qr-scanner-view';
import { isKioskQr, rejectMessage, type ScanErrorAction } from './scan-errors';
import { ScanResultSheet } from './scan-result-sheet';
import { usePreciseLocation } from './use-precise-location';
import { useScanFlow } from './use-scan-flow';

// Library pemindai (+ polyfill ZXing) hanya dimuat di halaman ini dan hanya di browser.
const QrScannerView = dynamic(() => import('./qr-scanner-view').then((m) => m.QrScannerView), {
  ssr: false,
  loading: () => <Skeleton className="aspect-square w-full rounded-2xl" />,
});

type ClientEnv = 'ok' | 'insecure' | 'no-camera';

const noopSubscribe = () => () => {};
const readEnv = (): ClientEnv =>
  !window.isSecureContext
    ? 'insecure'
    : typeof navigator.mediaDevices?.getUserMedia !== 'function'
      ? 'no-camera'
      : 'ok';

/** Halaman scan absen karyawan (`/app/scan`). */
export function ScanView() {
  const router = useRouter();
  const online = useOnline();
  const env = useSyncExternalStore(noopSubscribe, readEnv, () => null);
  const location = usePreciseLocation();
  const scan = useScanAttendance();
  const flow = useScanFlow({ waitForFix: location.waitForFix, submit: scan.mutateAsync });
  const [camera, setCamera] = useState<{ state: CheckState; denied: boolean; message?: string }>({
    state: 'pending',
    denied: false,
  });
  const [scannerKey, setScannerKey] = useState(0);

  const onCameraState = useCallback(
    (state: CameraState, error?: { kind: string; message: string }) =>
      setCamera({
        state: state === 'ready' ? 'ok' : state === 'error' ? 'error' : 'pending',
        denied: error?.kind === 'permission-denied',
        message: error?.message,
      }),
    [],
  );

  const retry = () => {
    setScannerKey((key) => key + 1);
    location.refresh();
  };

  const { reset } = flow;
  const { refresh } = location;
  const onAction = useCallback(
    (action: ScanErrorAction) => {
      if (action === 'scan-again') reset();
      else if (action === 'refresh-location') {
        refresh();
        reset();
      } else router.push(action === 'history' ? '/app/history' : '/app');
    },
    [reset, refresh, router],
  );

  const locationState: CheckState =
    location.status === 'ready' ? 'ok' : location.status === 'error' ? 'error' : 'pending';
  const permissionLocation = {
    state: locationState,
    accuracy: location.position?.accuracy,
    message: location.error?.message,
  };
  const denied = camera.denied || location.error?.code === 'PERMISSION_DENIED';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Scan Absen</h1>
        <p className="text-sm text-muted-foreground">Arahkan kamera ke QR di layar kiosk kantor.</p>
      </div>

      {env === null ? (
        <Skeleton className="aspect-square w-full rounded-2xl" />
      ) : env !== 'ok' ? (
        <Blocker
          icon={env === 'insecure' ? ShieldAlertIcon : CameraOffIcon}
          title={env === 'insecure' ? 'Koneksi tidak aman' : 'Kamera tidak tersedia'}
          message={
            env === 'insecure'
              ? 'Kamera & lokasi hanya dapat dipakai bila aplikasi dibuka lewat HTTPS. Buka alamat resmi AbsenYok (https://…).'
              : 'Browser ini tidak dapat mengakses kamera. Gunakan Chrome (Android) atau Safari (iPhone) versi terbaru.'
          }
        />
      ) : !online ? (
        <Blocker
          icon={WifiOffIcon}
          title="Anda sedang offline"
          message="Anda sedang offline. Absensi membutuhkan koneksi internet."
        />
      ) : (
        <>
          <PermissionChecklist camera={camera} location={permissionLocation} />
          <div className="relative">
            <QrScannerView
              key={scannerKey}
              onDecode={(value) => void flow.handleDecode(value)}
              paused={flow.phase !== 'scanning'}
              validate={isKioskQr}
              rejectMessage={rejectMessage}
              onCameraState={onCameraState}
              className={camera.state === 'error' ? 'hidden' : undefined}
            />
            {flow.phase === 'processing' ? (
              <div
                role="status"
                aria-live="assertive"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/65 text-white backdrop-blur-sm"
              >
                <Loader2Icon className="size-10 animate-spin" aria-hidden="true" />
                <p className="text-lg font-semibold">Memproses absensi…</p>
              </div>
            ) : null}
          </div>
          <PermissionNotes camera={camera} location={permissionLocation} />
          {/* Di bawah pemindai: kamera gagal → pemindai disembunyikan & panduan naik ke posisinya;
              hanya lokasi ditolak → pemindai tetap di tempat (tanpa layout shift). */}
          {denied ? <PermissionGuide onRetry={retry} /> : null}
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Kamera bermasalah?{' '}
        <Link
          href="/app/my-qr"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          <QrCodeIcon className="size-4" aria-hidden="true" />
          Tampilkan QR personal
        </Link>
      </p>

      <ScanResultSheet outcome={flow.outcome} onAction={onAction} />
    </div>
  );
}

function Blocker({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <section
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
    </section>
  );
}
