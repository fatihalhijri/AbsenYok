import { Loader2Icon } from 'lucide-react';

/** Layar tunggu saat sesi dipulihkan / diarahkan ulang. */
export function SplashScreen({ message = 'Memuat sesi…' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4"
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold tracking-tighter text-primary-foreground shadow-md"
      >
        AY
      </span>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        {message}
      </p>
    </div>
  );
}
