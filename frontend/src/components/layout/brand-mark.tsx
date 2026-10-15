import { env } from '@/lib/env';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  /** Class untuk teks nama (mis. disembunyikan saat sidebar diciutkan). */
  nameClassName?: string;
}

/** Logo "AY" + nama aplikasi. Nama instansi dari /settings/public menyusul di FE-03. */
export function BrandMark({ className, nameClassName }: BrandMarkProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold tracking-tighter text-primary-foreground"
      >
        AY
      </span>
      <span className={cn('truncate text-base font-semibold', nameClassName)}>
        {env.NEXT_PUBLIC_APP_NAME}
      </span>
    </span>
  );
}
