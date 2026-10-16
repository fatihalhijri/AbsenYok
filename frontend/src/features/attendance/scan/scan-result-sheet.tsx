'use client';

import { HistoryIcon, HomeIcon, MapPinnedIcon, ScanQrCodeIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type CSSProperties, useEffect } from 'react';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { formatTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '@/types';
import { ACTION_LABELS, describeScanError, type ScanErrorAction } from './scan-errors';
import type { ScanOutcome } from './use-scan-flow';

/** Lama layar sukses sebelum otomatis kembali ke beranda. */
export const AUTO_REDIRECT_MS = 5_000;

interface ScanResultSheetProps {
  outcome: ScanOutcome | null;
  onAction: (action: ScanErrorAction) => void;
  /** Disediakan agar bisa dimatikan di FE-09 (scan petugas). Default aktif. */
  autoRedirect?: boolean;
}

const ACTION_ICONS: Record<ScanErrorAction, LucideIcon> = {
  'scan-again': ScanQrCodeIcon,
  'refresh-location': MapPinnedIcon,
  history: HistoryIcon,
  home: HomeIcon,
};

/** Layar hasil scan (full-screen sheet): sukses dengan centang beranimasi, atau gagal + aksi. */
export function ScanResultSheet({ outcome, onAction, autoRedirect = true }: ScanResultSheetProps) {
  return (
    <Sheet
      open={outcome !== null}
      onOpenChange={(open) => {
        if (!open) onAction(outcome?.kind === 'success' ? 'home' : 'scan-again');
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto flex max-h-dvh w-full max-w-[480px] flex-col justify-center gap-0 overflow-y-auto px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] data-[side=bottom]:h-dvh data-[side=bottom]:border-t-0"
      >
        {outcome?.kind === 'success' ? (
          <SuccessContent outcome={outcome} onAction={onAction} autoRedirect={autoRedirect} />
        ) : outcome?.kind === 'error' ? (
          <ErrorContent outcome={outcome} onAction={onAction} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SuccessContent({
  outcome,
  onAction,
  autoRedirect,
}: {
  outcome: Extract<ScanOutcome, { kind: 'success' }>;
  onAction: (action: ScanErrorAction) => void;
  autoRedirect: boolean;
}) {
  const { type, attendance, message } = outcome.result;
  const at = type === 'CHECK_IN' ? attendance.checkInAt : attendance.checkOutAt;

  useEffect(() => {
    if (!autoRedirect) return;
    const timer = setTimeout(() => onAction('home'), AUTO_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [autoRedirect, onAction]);

  return (
    <div className="flex flex-col items-center gap-5 text-center" data-outcome="success">
      <SuccessMark />
      <div className="space-y-1">
        <SheetTitle className="text-2xl font-bold">
          {type === 'CHECK_IN' ? 'Absen Masuk Berhasil' : 'Absen Pulang Berhasil'}
        </SheetTitle>
        {at ? (
          <p className="text-6xl font-bold tracking-tight tabular-nums">{formatTime(at)}</p>
        ) : null}
      </div>
      <StatusBadge status={attendance.status as AttendanceStatus} />
      <SheetDescription className="text-base text-foreground/80">{message}</SheetDescription>
      <div className="w-full space-y-2 pt-2">
        <Button size="lg" className="h-12 w-full text-base" onClick={() => onAction('home')}>
          <HomeIcon aria-hidden="true" />
          Kembali ke Beranda
        </Button>
        {autoRedirect ? (
          <div className="space-y-1">
            <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full origin-left animate-deplete rounded-full bg-primary"
                style={{ '--deplete-duration': `${AUTO_REDIRECT_MS}ms` } as CSSProperties}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Kembali otomatis dalam {AUTO_REDIRECT_MS / 1000} detik
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ErrorContent({
  outcome,
  onAction,
}: {
  outcome: Extract<ScanOutcome, { kind: 'error' }>;
  onAction: (action: ScanErrorAction) => void;
}) {
  const { error } = outcome;
  const view = describeScanError(error.code, error.message, error.details);
  return (
    <div className="flex flex-col items-center gap-5 text-center" data-outcome={error.code}>
      <ErrorMark />
      <div className="space-y-2">
        <SheetTitle className="text-2xl font-bold">{view.title}</SheetTitle>
        <SheetDescription className="text-base text-foreground/80">{view.message}</SheetDescription>
      </div>
      {view.facts.length > 0 ? (
        <dl className={cn('grid w-full gap-2', view.facts.length > 1 && 'grid-cols-2')}>
          {view.facts.map((fact) => (
            <div key={fact.label} className="rounded-xl bg-muted/70 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {view.hint ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          {view.hint}
        </p>
      ) : null}
      <div className="w-full space-y-2 pt-2">
        {view.actions.map((action, index) => {
          const Icon = ACTION_ICONS[action];
          return (
            <Button
              key={action}
              size="lg"
              variant={index === 0 ? 'default' : 'outline'}
              className="h-12 w-full text-base"
              onClick={() => onAction(action)}
            >
              <Icon aria-hidden="true" />
              {ACTION_LABELS[action]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function SuccessMark() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="size-28 animate-pop text-success motion-reduce:animate-none"
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="44" className="fill-success/12" />
      <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="4" />
      <path
        d="M28 50 l13 13 l27 -29"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="70"
        className="animate-draw motion-reduce:animate-none"
        style={{ '--dash': 70 } as CSSProperties}
      />
    </svg>
  );
}

function ErrorMark() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="size-28 animate-pop text-destructive motion-reduce:animate-none"
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="44" className="fill-destructive/10" />
      <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="4" />
      <path
        d="M34 34 L62 62 M62 34 L34 62"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
