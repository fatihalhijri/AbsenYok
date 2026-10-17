'use client';

import {
  CameraIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MapPinIcon,
  RotateCwIcon,
  XCircleIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CheckState = 'pending' | 'ok' | 'error';

/** Batas akurasi GPS backend (GEOFENCE_MAX_ACCURACY_METERS default). */
export const MAX_ACCURACY_METERS = 100;

interface PermissionChecklistProps {
  camera: { state: CheckState; message?: string };
  location: { state: CheckState; accuracy?: number; message?: string };
}

/** Status izin Kamera & Lokasi di atas pemindai (tinggi tetap — tidak menggeser pemindai). */
export function PermissionChecklist({ camera, location }: PermissionChecklistProps) {
  const accuracy = location.accuracy;
  const accuracyLow = accuracy !== undefined && accuracy > MAX_ACCURACY_METERS;

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-2" aria-label="Status izin">
        <Item
          icon={CameraIcon}
          label="Kamera"
          state={camera.state}
          detail={
            camera.state === 'ok' ? 'Aktif' : camera.state === 'pending' ? 'Membuka…' : 'Gagal'
          }
        />
        <Item
          icon={MapPinIcon}
          label="Lokasi"
          state={location.state === 'ok' && accuracyLow ? 'error' : location.state}
          detail={
            location.state === 'ok' && accuracy !== undefined
              ? `±${Math.round(accuracy)} m`
              : location.state === 'pending'
                ? 'Mencari…'
                : 'Gagal'
          }
          detailClassName={accuracyLow ? 'text-destructive font-semibold' : undefined}
        />
      </ul>
    </div>
  );
}

const STATE_ICON: Record<CheckState, { icon: LucideIcon; className: string; label: string }> = {
  ok: { icon: CheckCircle2Icon, className: 'text-success', label: 'siap' },
  pending: {
    icon: Loader2Icon,
    className: 'animate-spin text-muted-foreground',
    label: 'menunggu',
  },
  error: { icon: XCircleIcon, className: 'text-destructive', label: 'bermasalah' },
};

function Item({
  icon: Icon,
  label,
  state,
  detail,
  detailClassName,
}: {
  icon: LucideIcon;
  label: string;
  state: CheckState;
  detail: string;
  detailClassName?: string;
}) {
  const status = STATE_ICON[state];
  const StatusIcon = status.icon;
  return (
    <li
      className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2"
      aria-label={`${label}: ${status.label}, ${detail}`}
      data-state={state}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className={cn('block text-sm font-medium tabular-nums', detailClassName)}>
          {detail}
        </span>
      </span>
      <StatusIcon className={cn('size-5 shrink-0', status.className)} aria-hidden="true" />
    </li>
  );
}

/**
 * Panduan mengaktifkan izin (izin ditolak, bukan gangguan sementara). Dirender di bawah pemindai
 * agar kemunculannya tidak menggeser kotak kamera (CLS).
 */
export function PermissionGuide({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-label="Cara mengaktifkan izin"
      className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <h2 className="font-semibold">Aktifkan izin kamera & lokasi</h2>
      <div className="space-y-1">
        <p className="font-medium">Android (Chrome)</p>
        <ol className="list-decimal space-y-0.5 pl-5 text-muted-foreground">
          <li>Ketuk ikon pengaturan situs (di kiri alamat web).</li>
          <li>
            Pilih &ldquo;Izin&rdquo;, lalu ubah Kamera & Lokasi menjadi &ldquo;Izinkan&rdquo;.
          </li>
          <li>Pastikan Lokasi/GPS HP menyala, lalu ketuk &ldquo;Coba lagi&rdquo;.</li>
        </ol>
      </div>
      <div className="space-y-1">
        <p className="font-medium">iPhone (Safari)</p>
        <ol className="list-decimal space-y-0.5 pl-5 text-muted-foreground">
          <li>Ketuk ikon &ldquo;aA&rdquo; di bilah alamat → Pengaturan Situs Web.</li>
          <li>Ubah Kamera & Lokasi menjadi &ldquo;Izinkan&rdquo;.</li>
          <li>
            Bila tetap gagal: Pengaturan → Privasi & Keamanan → Layanan Lokasi → Safari →
            &ldquo;Saat Digunakan&rdquo;.
          </li>
        </ol>
      </div>
      <Button variant="outline" className="min-h-11 w-full" onClick={onRetry}>
        <RotateCwIcon aria-hidden="true" />
        Coba lagi
      </Button>
    </section>
  );
}

/**
 * Pesan rinci kamera/lokasi (gagal, GPS lemah). Dirender DI BAWAH pemindai agar kemunculannya
 * tidak mendorong kotak kamera ke bawah (layout shift).
 */
export function PermissionNotes({ camera, location }: PermissionChecklistProps) {
  const accuracy = location.accuracy;
  const accuracyLow = accuracy !== undefined && accuracy > MAX_ACCURACY_METERS;
  return (
    <div className="space-y-1 empty:hidden">
      {camera.state === 'error' && camera.message ? (
        <p className="text-sm text-destructive" role="alert">
          {camera.message}
        </p>
      ) : null}
      {location.state === 'error' && location.message ? (
        <p className="text-sm text-destructive" role="alert">
          {location.message}
        </p>
      ) : null}
      {location.state === 'ok' && accuracyLow ? (
        <p className="text-sm text-destructive">
          Sinyal GPS lemah (maks {MAX_ACCURACY_METERS} m). Pindah ke dekat jendela/area terbuka.
        </p>
      ) : null}
    </div>
  );
}
