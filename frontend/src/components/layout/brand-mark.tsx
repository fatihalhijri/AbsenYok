'use client';

import { usePublicSettings } from '@/features/settings/hooks';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  /** Class untuk teks nama (mis. disembunyikan saat sidebar diciutkan). */
  nameClassName?: string;
  /** `company` = nama instansi dari /settings/public (fallback nama aplikasi); `app` = AbsenYok. */
  label?: 'company' | 'app';
}

/** Logo "AY" + nama instansi/aplikasi. */
export function BrandMark({ className, nameClassName, label = 'company' }: BrandMarkProps) {
  const { companyName } = usePublicSettings();
  const name = label === 'company' ? companyName : env.NEXT_PUBLIC_APP_NAME;
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold tracking-tighter text-primary-foreground"
      >
        AY
      </span>
      <span className={cn('truncate text-base font-semibold', nameClassName)}>{name}</span>
    </span>
  );
}
