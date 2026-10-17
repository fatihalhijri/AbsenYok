'use client';

import { useNow } from '@/hooks/use-now';
import { inAppTz } from '@/lib/date';

/** Jam digital besar (HH:mm:ss, zona APP_TIMEZONE, jam server) + tanggal lengkap. */
export function KioskClock({ offsetMs }: { offsetMs: number }) {
  const now = useNow(1000);
  if (now === null) {
    return <div className="h-32" aria-hidden="true" />;
  }
  const local = inAppTz(now + offsetMs);
  return (
    <div>
      <time
        dateTime={new Date(now + offsetMs).toISOString()}
        className="block text-[clamp(3.5rem,8vw,7.5rem)] leading-none font-bold tracking-tight tabular-nums"
        suppressHydrationWarning
      >
        {local.format('HH:mm')}
        <span className="text-[0.55em] text-muted-foreground">:{local.format('ss')}</span>
      </time>
      <p className="mt-2 text-xl text-muted-foreground lg:text-2xl">
        {local.format('dddd, D MMMM YYYY')}
      </p>
    </div>
  );
}
