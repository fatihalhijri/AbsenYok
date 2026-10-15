'use client';

import {
  CalendarOffIcon,
  CalendarX2Icon,
  Clock3Icon,
  HeartPulseIcon,
  type LucideIcon,
  LogInIcon,
  LogOutIcon,
  PartyPopperIcon,
  ScanQrCodeIcon,
  TimerIcon,
  UserXIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { formatMinutes, formatTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AttendanceStatus, MyToday } from '@/types';
import { deriveTodayState, LEAVE_TYPE_LABELS } from '../today-status';
import { Countdown, LiveDuration } from './live-time';

interface TodayStatusCardProps {
  today: MyToday;
  /** Selisih jam server − perangkat (ms) untuk hitung mundur/durasi. */
  offsetMs?: number;
  /** Muat ulang data hari ini (mis. saat hitung mundur habis). */
  onRefresh?: () => void;
}

/** Kartu utama beranda: apa yang harus/bisa dilakukan karyawan hari ini. */
export function TodayStatusCard({ today, offsetMs = 0, onRefresh }: TodayStatusCardProps) {
  const state = deriveTodayState(today);

  switch (state.kind) {
    case 'ready':
      return (
        <Shell tone="primary" icon={ScanQrCodeIcon} title="Belum absen masuk" state={state.kind}>
          <p className="text-sm text-primary-foreground/85">
            {state.closesAt
              ? `Absen masuk dibuka sampai pukul ${formatTime(state.closesAt)}.`
              : 'Silakan scan QR di kiosk kantor.'}
          </p>
          <ScanButton label="Scan Absen Masuk" icon={LogInIcon} />
        </Shell>
      );

    case 'not-open':
      return (
        <Shell tone="neutral" icon={Clock3Icon} title="Belum waktunya absen" state={state.kind}>
          <p className="text-sm text-muted-foreground">
            Absen masuk dibuka pukul{' '}
            <strong className="text-foreground">{formatTime(state.opensAt)}</strong>
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">dalam</span>
            <Countdown
              target={state.opensAt}
              offsetMs={offsetMs}
              onDone={onRefresh}
              className="text-3xl font-semibold"
            />
          </p>
        </Shell>
      );

    case 'checked-in': {
      const { attendance } = state;
      return (
        <Shell tone="primary" icon={TimerIcon} title="Sedang bekerja" state={state.kind}>
          <div className="flex flex-wrap items-center gap-2 text-sm text-primary-foreground/85">
            <span>
              Masuk pukul{' '}
              <strong className="text-primary-foreground">
                {formatTime(attendance.checkInAt ?? '')}
              </strong>
            </span>
            <StatusBadge status={attendance.status as AttendanceStatus} className="bg-background" />
            {attendance.lateMinutes > 0 ? (
              <span>(+{formatMinutes(attendance.lateMinutes)})</span>
            ) : null}
          </div>
          <div>
            <p className="text-xs tracking-wide text-primary-foreground/75 uppercase">
              Durasi kerja
            </p>
            <LiveDuration
              since={attendance.checkInAt ?? ''}
              offsetMs={offsetMs}
              className="text-4xl font-semibold"
            />
          </div>
          {state.canCheckOut ? (
            <ScanButton label="Scan Absen Pulang" icon={LogOutIcon} />
          ) : state.checkOutAvailableAt ? (
            <p className="rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm">
              Absen pulang tersedia pukul {formatTime(state.checkOutAvailableAt)} (
              <Countdown
                target={state.checkOutAvailableAt}
                offsetMs={offsetMs}
                onDone={onRefresh}
              />
              )
            </p>
          ) : null}
        </Shell>
      );
    }

    case 'checked-out': {
      const { attendance } = state;
      return (
        <Shell
          tone="success"
          icon={PartyPopperIcon}
          title="Absen hari ini selesai"
          state={state.kind}
        >
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Metric label="Masuk" value={formatTime(attendance.checkInAt ?? '')} />
            <Metric label="Pulang" value={formatTime(attendance.checkOutAt ?? '')} />
            <Metric label="Total kerja" value={formatMinutes(attendance.workMinutes)} />
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={attendance.status as AttendanceStatus} />
            {attendance.earlyLeaveMinutes > 0 ? (
              <span className="text-xs text-muted-foreground">
                Pulang lebih awal {formatMinutes(attendance.earlyLeaveMinutes)}
              </span>
            ) : null}
          </div>
          <p className="font-medium">Terima kasih, sampai jumpa besok!</p>
        </Shell>
      );
    }

    case 'on-leave':
      return (
        <Shell
          tone="info"
          icon={HeartPulseIcon}
          title={`Anda sedang ${(state.leaveType ? LEAVE_TYPE_LABELS[state.leaveType] : 'izin').toLowerCase()} hari ini`}
          state={state.kind}
        >
          <p className="text-sm text-muted-foreground">
            Pengajuan Anda sudah disetujui — tidak perlu absen. Semoga lekas kembali beraktivitas.
          </p>
        </Shell>
      );

    case 'holiday':
      return (
        <Shell tone="info" icon={CalendarOffIcon} title="Hari ini libur" state={state.kind}>
          <p className="text-sm text-muted-foreground">{state.name}. Tidak ada absensi hari ini.</p>
        </Shell>
      );

    case 'non-working-day':
      return (
        <Shell tone="info" icon={CalendarOffIcon} title="Bukan hari kerja Anda" state={state.kind}>
          <p className="text-sm text-muted-foreground">
            Sesuai jadwal shift, hari ini Anda tidak perlu absen. Selamat beristirahat!
          </p>
        </Shell>
      );

    case 'no-shift':
      return (
        <Shell
          tone="warning"
          icon={CalendarX2Icon}
          title="Belum ada jadwal shift"
          state={state.kind}
        >
          <p className="text-sm text-muted-foreground">
            Akun Anda belum memiliki shift sehingga belum bisa absen. Hubungi admin.
          </p>
        </Shell>
      );

    case 'missed':
      return (
        <Shell
          tone="warning"
          icon={UserXIcon}
          title={state.absent ? 'Anda tercatat alpa hari ini' : 'Jam absen masuk sudah berakhir'}
          state={state.kind}
        >
          <p className="text-sm text-muted-foreground">
            {state.closesAt ? `Absen masuk ditutup pukul ${formatTime(state.closesAt)}. ` : null}
            Bila ada kendala, ajukan izin atau hubungi admin.
          </p>
        </Shell>
      );
  }
}

type Tone = 'primary' | 'success' | 'info' | 'warning' | 'neutral';

const TONES: Record<Tone, { card: string; icon: string }> = {
  primary: {
    card: 'bg-primary text-primary-foreground border-primary shadow-lg',
    icon: 'bg-primary-foreground/15 text-primary-foreground',
  },
  success: { card: 'bg-card', icon: 'bg-success/15 text-success' },
  info: { card: 'bg-card', icon: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  warning: { card: 'bg-card', icon: 'bg-warning/15 text-amber-700 dark:text-warning' },
  neutral: { card: 'bg-card', icon: 'bg-muted text-muted-foreground' },
};

function Shell({
  tone,
  icon: Icon,
  title,
  state,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  state: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Status absensi hari ini"
      data-state={state}
      className={cn('space-y-4 rounded-2xl border p-5 shadow-sm', TONES[tone].card)}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl',
            TONES[tone].icon,
          )}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg leading-tight font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ScanButton({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <Button
      asChild
      size="lg"
      variant="secondary"
      className="h-14 w-full text-base font-semibold shadow-md"
    >
      <Link href="/app/scan">
        <Icon className="size-5" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
