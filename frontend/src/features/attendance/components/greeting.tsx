'use client';

import { useNow } from '@/hooks/use-now';
import { inAppTz } from '@/lib/date';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveClock } from './live-time';

function greetingFor(hour: number): string {
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/**
 * Salam + tanggal (diperbarui tiap menit) dan jam berjalan (komponen terpisah, tiap detik).
 */
export function Greeting({ name, offsetMs = 0 }: { name: string | undefined; offsetMs?: number }) {
  const now = useNow(60_000);
  const firstName = name?.trim().split(/\s+/)[0] ?? '';

  if (now === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-44" />
      </div>
    );
  }
  const local = inAppTz(now + offsetMs);
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl leading-tight font-semibold text-balance break-words">
          {greetingFor(local.hour())}
          {firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-sm text-muted-foreground">{local.format('dddd, D MMMM YYYY')}</p>
      </div>
      <LiveClock offsetMs={offsetMs} className="text-lg font-semibold text-primary" />
    </div>
  );
}
