'use client';

import { useEffect, useRef } from 'react';
import { useNow } from '@/hooks/use-now';
import { formatClockDuration, inAppTz } from '@/lib/date';
import { cn } from '@/lib/utils';

/*
 * Komponen waktu "hidup". Hanya komponen INI yang berlangganan detik (useNow) sehingga
 * berdetaknya jam tidak me-render ulang kartu/halaman di atasnya.
 */

interface LiveProps {
  /** Selisih jam server − jam perangkat (ms). */
  offsetMs?: number;
  className?: string;
}

/** Jam berjalan HH:mm:ss di zona APP_TIMEZONE. */
export function LiveClock({ offsetMs = 0, className }: LiveProps) {
  const now = useNow(1000);
  const value = now === null ? '--:--:--' : inAppTz(now + offsetMs).format('HH:mm:ss');
  return (
    <time
      className={cn('tabular-nums', className)}
      dateTime={now === null ? undefined : new Date(now + offsetMs).toISOString()}
      aria-live="off"
      suppressHydrationWarning
    >
      {value}
    </time>
  );
}

/** Lama berjalan sejak `since` (mis. durasi kerja sejak absen masuk) dalam H:MM:SS. */
export function LiveDuration({ since, offsetMs = 0, className }: LiveProps & { since: string }) {
  const now = useNow(1000);
  const value = now === null ? '-:--:--' : formatClockDuration(now + offsetMs - Date.parse(since));
  return (
    <span className={cn('tabular-nums', className)} role="timer" aria-live="off">
      {value}
    </span>
  );
}

/** Sisa waktu sampai `target` ("1:05:09" / "05:09"); memanggil `onDone` sekali saat habis. */
export function Countdown({
  target,
  offsetMs = 0,
  onDone,
  className,
}: LiveProps & { target: string; onDone?: () => void }) {
  const now = useNow(1000);
  const remaining = now === null ? null : Date.parse(target) - (now + offsetMs);
  const done = remaining !== null && remaining <= 0;
  const fired = useRef(false);

  useEffect(() => {
    if (done && !fired.current) {
      fired.current = true;
      onDone?.();
    }
  }, [done, onDone]);

  let value = '--:--';
  if (remaining !== null) {
    const total = Math.max(0, Math.ceil(remaining / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    value =
      hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }
  return (
    <span className={cn('tabular-nums', className)} role="timer" aria-live="off">
      {value}
    </span>
  );
}
