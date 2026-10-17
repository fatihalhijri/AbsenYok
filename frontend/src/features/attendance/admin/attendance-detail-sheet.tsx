'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2Icon,
  HistoryIcon,
  MapPinIcon,
  PencilIcon,
  ScrollTextIcon,
  XCircleIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { auditDetails } from '@/features/audit-logs/diff';
import { LOOKUP_QUERY, locationsApi, masterKeys } from '@/features/master/api';
import { formatDateLong, formatDateTime, formatMinutes, formatTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import type { AttendanceCorrection, AttendanceDetail, AttendanceStatus, ScanLog } from '@/types';
import { attendanceAdminApi, attendanceAdminKeys } from './api';
import { METHOD_META } from './method-icons';
import { SCAN_POINT_COLORS, SCAN_POINT_LABELS, scanPoints } from './scan-points';

const ScanPointsMap = dynamic(() => import('./scan-points-map'), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

interface AttendanceDetailSheetProps {
  attendanceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrect: (detail: AttendanceDetail) => void;
}

/** Detail satu absensi: info lengkap, peta titik scan vs radius, log scan hari itu, koreksi. */
export function AttendanceDetailSheet({
  attendanceId,
  open,
  onOpenChange,
  onCorrect,
}: AttendanceDetailSheetProps) {
  const detail = useQuery({
    queryKey: attendanceAdminKeys.detail(attendanceId ?? ''),
    queryFn: () => attendanceAdminApi.detail(attendanceId ?? ''),
    enabled: Boolean(attendanceId),
  });
  const data = detail.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
        data-testid="attendance-detail"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{data ? data.user.name : 'Detail absensi'}</SheetTitle>
          <SheetDescription>
            {data
              ? `${data.user.employeeCode}${data.user.department ? ` · ${data.user.department.name}` : ''} · ${formatDateLong(data.date)}`
              : 'Memuat…'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 p-4">
          {detail.isError ? (
            <ErrorState
              message={getErrorMessage(detail.error)}
              onRetry={() => void detail.refetch()}
            />
          ) : !data ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : (
            <DetailBody detail={data} />
          )}
        </div>

        {data ? (
          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            <Button onClick={() => onCorrect(data)}>
              <PencilIcon aria-hidden="true" />
              Koreksi
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ detail }: { detail: AttendanceDetail }) {
  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status as AttendanceStatus} />
          {detail.leaveRequest ? <Badge variant="outline">Dari pengajuan izin/cuti</Badge> : null}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label="Jam masuk" value={detail.checkInAt ? formatTime(detail.checkInAt) : '—'}>
            {detail.checkInMethod ? METHOD_META[detail.checkInMethod].label : null}
          </Fact>
          <Fact label="Jam pulang" value={detail.checkOutAt ? formatTime(detail.checkOutAt) : '—'}>
            {detail.checkOutMethod ? METHOD_META[detail.checkOutMethod].label : null}
          </Fact>
          <Fact label="Lama kerja" value={formatMinutes(detail.workMinutes)} />
          <Fact label="Terlambat" value={formatMinutes(detail.lateMinutes)} />
          <Fact label="Pulang cepat" value={formatMinutes(detail.earlyLeaveMinutes)} />
          <Fact label="Shift" value={detail.shiftSnapshot ? detail.shiftSnapshot.name : '—'}>
            {detail.shiftSnapshot
              ? `${detail.shiftSnapshot.startTime}–${detail.shiftSnapshot.endTime} · toleransi ${detail.shiftSnapshot.lateToleranceMinutes} m`
              : null}
          </Fact>
        </dl>
        <dl className="grid gap-2 text-sm">
          {detail.kiosk ? <InfoRow label="Kiosk" value={detail.kiosk.name} /> : null}
          {detail.location ? <InfoRow label="Lokasi" value={detail.location.name} /> : null}
          {detail.scannedBy ? (
            <InfoRow label="Dipindai oleh" value={detail.scannedBy.name} />
          ) : null}
          {detail.note ? <InfoRow label="Catatan" value={detail.note} /> : null}
        </dl>
      </section>

      <ScanMapSection detail={detail} />

      <Separator />
      <section aria-labelledby="scan-logs-title" className="space-y-3">
        <h3 id="scan-logs-title" className="flex items-center gap-2 font-semibold">
          <ScrollTextIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Log scan hari itu
          <span className="text-sm font-normal text-muted-foreground">
            ({detail.scanLogs.length})
          </span>
        </h3>
        {detail.scanLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada percobaan scan pada tanggal ini.
          </p>
        ) : (
          <ol className="space-y-2">
            {detail.scanLogs.map((log) => (
              <ScanLogItem key={log.id} log={log} />
            ))}
          </ol>
        )}
      </section>

      <Separator />
      <section aria-labelledby="corrections-title" className="space-y-3">
        <h3 id="corrections-title" className="flex items-center gap-2 font-semibold">
          <HistoryIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Riwayat koreksi
        </h3>
        {detail.corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum pernah dikoreksi.</p>
        ) : (
          <ol className="space-y-3">
            {detail.corrections.map((correction) => (
              <CorrectionItem key={correction.id} correction={correction} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function ScanMapSection({ detail }: { detail: AttendanceDetail }) {
  const locations = useQuery({
    queryKey: masterKeys.locationList(LOOKUP_QUERY),
    queryFn: () => locationsApi.list(LOOKUP_QUERY),
    staleTime: 5 * 60_000,
  });
  const location = locations.data?.items.find((item) => item.id === detail.location?.id);
  const points = scanPoints(detail);
  if (!detail.location && points.length === 0) return null;

  return (
    <section aria-labelledby="scan-map-title" className="space-y-2">
      <h3 id="scan-map-title" className="flex items-center gap-2 font-semibold">
        <MapPinIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Titik scan vs radius lokasi
      </h3>
      {location ? (
        <>
          <div
            className="isolate h-56 overflow-hidden rounded-xl border"
            data-testid="scan-points-map"
          >
            <ScanPointsMap
              location={{
                latitude: location.latitude,
                longitude: location.longitude,
                radiusMeters: location.radiusMeters,
                name: location.name,
              }}
              points={points}
            />
          </div>
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
            aria-label="Legenda peta"
          >
            <li className="flex items-center gap-1.5">
              <span
                className="size-3 rounded-full border-2 border-emerald-600 bg-emerald-600/15"
                aria-hidden="true"
              />
              Radius {location.name} ({location.radiusMeters} m)
            </li>
            {(['in', 'out', 'failed'] as const)
              .filter((kind) => points.some((point) => point.kind === kind))
              .map((kind) => (
                <li key={kind} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: SCAN_POINT_COLORS[kind] }}
                    aria-hidden="true"
                  />
                  {SCAN_POINT_LABELS[kind]}
                </li>
              ))}
          </ul>
          {points.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Tidak ada titik scan berkoordinat (mis. absensi manual).
            </p>
          ) : null}
        </>
      ) : locations.isPending ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : (
        <p className="text-sm text-muted-foreground">Koordinat lokasi tidak tersedia.</p>
      )}
    </section>
  );
}

function ScanLogItem({ log }: { log: ScanLog }) {
  const Icon = log.success ? CheckCircle2Icon : XCircleIcon;
  return (
    <li className="flex gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', log.success ? 'text-success' : 'text-destructive')}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium tabular-nums">{formatTime(log.createdAt)}</span>
          <span>{log.success ? 'Berhasil' : 'Gagal'}</span>
          {log.errorCode ? (
            <Badge variant="outline" className="font-mono text-[11px]">
              {log.errorCode}
            </Badge>
          ) : null}
          <span className="text-muted-foreground">
            {log.scanType === 'PERSONAL' ? 'QR personal' : (log.kiosk?.name ?? 'Kiosk')}
          </span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {log.distance != null ? `Jarak ${Math.round(log.distance)} m` : 'Jarak —'}
          {log.accuracy != null ? ` · akurasi ±${Math.round(log.accuracy)} m` : ''}
          {log.ipAddress ? ` · IP ${log.ipAddress}` : ''}
        </p>
      </div>
    </li>
  );
}

function CorrectionItem({ correction }: { correction: AttendanceCorrection }) {
  const details = auditDetails({ before: correction.before, after: correction.after });
  const changed = details.diff.filter((row) => row.changed);
  return (
    <li className="space-y-2 rounded-xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={correction.action === 'ATTENDANCE_CORRECTED' ? 'secondary' : 'outline'}>
          {correction.action === 'ATTENDANCE_CORRECTED' ? 'Koreksi' : 'Dibuat manual'}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDateTime(correction.createdAt)} · {correction.actor?.name ?? 'Sistem'}
        </span>
      </div>
      {correction.reason ? <p className="break-words">“{correction.reason}”</p> : null}
      {changed.length > 0 ? (
        <dl className="grid gap-1 text-xs">
          {changed.map((row) => (
            <div key={row.key} className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="tabular-nums">
                {details.hasBefore ? (
                  <>
                    <span className="text-muted-foreground line-through">{row.before}</span>
                    {' → '}
                  </>
                ) : null}
                <span className="font-medium">{row.after}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function Fact({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {children ? <dd className="truncate text-xs text-muted-foreground">{children}</dd> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
