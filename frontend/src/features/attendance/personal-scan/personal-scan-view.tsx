'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CameraOffIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MapPinIcon,
  ShieldAlertIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { StatusBadge } from '@/components/shared/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { dashboardKeys } from '@/features/dashboard/api';
import { LOOKUP_QUERY, locationsApi, masterKeys } from '@/features/master/api';
import { formatTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { AttendanceStatus, PersonalScanInput } from '@/types';
import { attendanceAdminApi, attendanceAdminKeys } from '../admin/api';
import type { CameraState } from '../scan/qr-scanner-view';
import { describeScanError, isPersonalQr, rejectPersonalMessage } from '../scan/scan-errors';
import { ScanResultSheet } from '../scan/scan-result-sheet';
import { usePreciseLocation } from '../scan/use-precise-location';
import { REARM_DELAY_MS, type SessionEntry, usePersonalScan } from './use-personal-scan';

const QrScannerView = dynamic(
  () => import('../scan/qr-scanner-view').then((m) => m.QrScannerView),
  { ssr: false, loading: () => <Skeleton className="aspect-square w-full rounded-2xl" /> },
);

const noopSubscribe = () => () => {};
const canUseCamera = () =>
  window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function';

/** `/admin/scan-personal`: petugas memindai QR personal karyawan (mode cadangan, scan beruntun). */
export function PersonalScanView() {
  const profile = useAuthStore((state) => state.user);
  const cameraSupported = useSyncExternalStore(noopSubscribe, canUseCamera, () => null);
  const queryClient = useQueryClient();
  const location = usePreciseLocation();
  const [continuous, setContinuous] = useState(true);
  const [pickedLocation, setPickedLocation] = useState<string | null>(null);
  const [camera, setCamera] = useState<{ state: CameraState; message?: string }>({
    state: 'starting',
  });
  const [scannerKey, setScannerKey] = useState(0);

  const locations = useQuery({
    queryKey: masterKeys.locationList(LOOKUP_QUERY),
    queryFn: () => locationsApi.list(LOOKUP_QUERY),
    staleTime: 5 * 60_000,
  });
  const active = (locations.data?.items ?? []).filter((item) => item.isActive);
  // Default: lokasi kerja petugas (bila aktif), selain itu lokasi aktif pertama.
  const locationId =
    pickedLocation ??
    active.find((item) => item.id === profile?.location?.id)?.id ??
    active[0]?.id ??
    null;
  const selectedLocation = active.find((item) => item.id === locationId) ?? null;

  const submit = useMutation({
    mutationFn: (input: PersonalScanInput) => attendanceAdminApi.personalScan(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceAdminKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
  const flow = usePersonalScan({
    locationId,
    waitForFix: location.waitForFix,
    submit: submit.mutateAsync,
    continuous,
  });

  const onCameraState = useCallback(
    (state: CameraState, error?: { kind: string; message: string }) =>
      setCamera({ state, message: error?.message }),
    [],
  );

  const { reset, retry } = flow;
  const { refresh } = location;
  const onAction = useCallback(
    (action: string) => {
      if (action === 'refresh-location') refresh();
      if (flow.outcome?.kind === 'error') retry();
      else reset();
    },
    [flow.outcome, refresh, reset, retry],
  );

  const successCount = flow.session.filter((entry) => entry.outcome.kind === 'success').length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="scan-location">Lokasi absen</Label>
              {locations.isPending ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={locationId ?? undefined} onValueChange={setPickedLocation}>
                  <SelectTrigger id="scan-location" className="min-h-10 w-full">
                    <SelectValue placeholder="Belum ada lokasi aktif" />
                  </SelectTrigger>
                  <SelectContent>
                    {active.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · radius {item.radiusMeters} m
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex min-h-10 items-center gap-3">
              <Switch id="scan-continuous" checked={continuous} onCheckedChange={setContinuous} />
              <Label htmlFor="scan-continuous" className="leading-tight">
                Scan beruntun
                <span className="block text-xs font-normal text-muted-foreground">
                  Aktif lagi {REARM_DELAY_MS / 1000} dtk setelah hasil
                </span>
              </Label>
            </div>
            <GpsStatus
              status={location.status}
              accuracy={location.position?.accuracy}
              message={location.error?.message}
              onRefresh={refresh}
            />
          </CardContent>
        </Card>

        {cameraSupported === null ? (
          <Skeleton className="aspect-square w-full rounded-2xl" />
        ) : !cameraSupported ? (
          <Alert variant="destructive">
            <ShieldAlertIcon aria-hidden="true" />
            <AlertTitle>Kamera tidak tersedia</AlertTitle>
            <AlertDescription>
              Kamera hanya bisa dipakai lewat HTTPS di browser yang mendukung. Buka alamat resmi
              AbsenYok (https://…) di Chrome/Safari terbaru.
            </AlertDescription>
          </Alert>
        ) : !selectedLocation && !locations.isPending ? (
          <Alert>
            <MapPinIcon aria-hidden="true" />
            <AlertTitle>Belum ada lokasi aktif</AlertTitle>
            <AlertDescription>
              Tambahkan/aktifkan lokasi di menu Lokasi terlebih dahulu.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mx-auto w-full max-w-lg space-y-2">
            {camera.state === 'error' ? (
              <Alert variant="destructive">
                <CameraOffIcon aria-hidden="true" />
                <AlertTitle>Kamera bermasalah</AlertTitle>
                <AlertDescription>
                  <p>{camera.message ?? 'Kamera tidak dapat dibuka.'}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setScannerKey((key) => key + 1)}
                  >
                    Coba lagi
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="relative" data-testid="personal-scanner">
              <QrScannerView
                key={scannerKey}
                onDecode={(value) => void flow.handleDecode(value)}
                paused={flow.phase !== 'scanning' || !locationId}
                validate={isPersonalQr}
                rejectMessage={rejectPersonalMessage}
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
                  <p className="text-lg font-semibold">Memproses…</p>
                </div>
              ) : null}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Minta karyawan membuka <strong>QR Saya</strong> di aplikasinya, lalu arahkan kamera ke
              QR tersebut.
            </p>
          </div>
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Hasil sesi ini</CardTitle>
          <CardDescription aria-live="polite">
            {flow.session.length === 0
              ? 'Belum ada scan.'
              : `${successCount} berhasil · ${flow.session.length - successCount} gagal`}
          </CardDescription>
          {flow.session.length > 0 ? (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={flow.clearSession}>
                <Trash2Icon aria-hidden="true" />
                Bersihkan
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {flow.session.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Hasil setiap scan tampil di sini — cocok untuk antrean karyawan.
            </p>
          ) : (
            <ol className="max-h-[60dvh] space-y-2 overflow-y-auto" data-testid="session-results">
              {flow.session.map((entry) => (
                <SessionItem key={entry.id} entry={entry} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <ScanResultSheet
        variant="compact"
        outcome={flow.outcome}
        onAction={onAction}
        autoContinueMs={continuous ? REARM_DELAY_MS : undefined}
      />
    </div>
  );
}

function GpsStatus({
  status,
  accuracy,
  message,
  onRefresh,
}: {
  status: 'locating' | 'ready' | 'error';
  accuracy?: number;
  message?: string;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
      <MapPinIcon
        className={cn(
          'size-4',
          status === 'ready'
            ? 'text-success'
            : status === 'error'
              ? 'text-destructive'
              : 'text-muted-foreground',
        )}
        aria-hidden="true"
      />
      <span aria-live="polite">
        {status === 'ready'
          ? `Lokasi petugas siap (±${Math.round(accuracy ?? 0)} m)`
          : status === 'error'
            ? (message ?? 'Lokasi tidak tersedia')
            : 'Mencari lokasi petugas…'}
      </span>
      <Button variant="link" size="sm" className="h-auto p-0" onClick={onRefresh}>
        Perbarui lokasi
      </Button>
    </div>
  );
}

const TYPE_LABELS = { CHECK_IN: 'Masuk', CHECK_OUT: 'Pulang' } as const;

function SessionItem({ entry }: { entry: SessionEntry }) {
  const { outcome } = entry;
  if (outcome.kind === 'success') {
    const { result } = outcome;
    return (
      <li
        className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2"
        data-outcome="success"
      >
        <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{result.user.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {TYPE_LABELS[result.type]} · {formatTime(entry.at)} ·{' '}
            <span className="font-mono">{result.user.employeeCode}</span>
          </p>
        </div>
        <StatusBadge status={result.attendance.status as AttendanceStatus} />
      </li>
    );
  }
  const view = describeScanError(outcome.error.code, outcome.error.message, outcome.error.details);
  return (
    <li
      className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2"
      data-outcome={outcome.error.code}
    >
      <XCircleIcon className="size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{view.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatTime(entry.at)} · {outcome.error.message}
        </p>
      </div>
    </li>
  );
}
