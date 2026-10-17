'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLinkIcon, MapPinIcon, MonitorSmartphoneIcon, TimerIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { kioskApi, kioskKeys } from '../api';

const PARAMS = { page: 1, limit: 100 };

/**
 * Daftar kiosk + tombol "Buka Layar Kiosk" (tab baru). Kelola kiosk (tambah/ubah/rotasi secret)
 * dilengkapi di FE-08.
 */
export function KioskList() {
  const kiosks = useQuery({
    queryKey: kioskKeys.list(PARAMS),
    queryFn: () => kioskApi.list(PARAMS),
  });

  if (kiosks.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }
  if (kiosks.isError) {
    return (
      <ErrorState
        className="rounded-xl border"
        message={getErrorMessage(kiosks.error)}
        onRetry={() => void kiosks.refetch()}
      />
    );
  }
  if (kiosks.data.items.length === 0) {
    return (
      <EmptyState
        className="rounded-xl border"
        icon={MonitorSmartphoneIcon}
        title="Belum ada kiosk"
        description="Tambahkan kiosk lewat menu kelola kiosk (segera hadir)."
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kiosks.data.items.map((kiosk) => (
        <li key={kiosk.id} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{kiosk.name}</h2>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="size-4" aria-hidden="true" />
                {kiosk.location.name}
              </p>
            </div>
            <Badge variant={kiosk.isActive ? 'default' : 'secondary'}>
              {kiosk.isActive ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Interval QR</dt>
              <dd className="flex items-center gap-1 font-medium">
                <TimerIcon className="size-4" aria-hidden="true" />
                {kiosk.qrIntervalSeconds} detik
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Terakhir terlihat</dt>
              <dd className="font-medium">
                {kiosk.lastSeenAt ? formatDateTime(kiosk.lastSeenAt) : 'Belum pernah'}
              </dd>
            </div>
          </dl>
          <Button asChild className="mt-auto min-h-10">
            <a href={`/kiosk/${kiosk.id}`} target="_blank" rel="noopener">
              <ExternalLinkIcon aria-hidden="true" />
              Buka Layar Kiosk
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}
