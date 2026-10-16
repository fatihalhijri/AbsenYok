'use client';

import { ClipboardListIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToday } from '@/hooks/use-today';
import { formatDateShort } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import type { LeaveRequest, LeaveStatus } from '@/types';
import { useCancelLeave, useLeaveQuota, useMyLeaves } from '../hooks';
import { LEAVE_TYPE_META } from '../meta';
import { LeaveCard } from './leave-card';
import { QuotaCard } from './quota-card';

const TABS: { value: 'ALL' | LeaveStatus; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
];

/** `/app/leave`: sisa cuti + daftar pengajuan per status + batalkan (PENDING). */
export function LeaveListView() {
  const today = useToday();
  const quota = useLeaveQuota(today ? Number(today.slice(0, 4)) : null);
  const leaves = useMyLeaves();
  const cancel = useCancelLeave();
  const [target, setTarget] = useState<LeaveRequest | null>(null);

  const byStatus = useMemo(() => {
    const items = leaves.data ?? [];
    return Object.fromEntries(
      TABS.map(({ value }) => [
        value,
        value === 'ALL' ? items : items.filter((item) => item.status === value),
      ]),
    ) as Record<(typeof TABS)[number]['value'], LeaveRequest[]>;
  }, [leaves.data]);

  const confirmCancel = async () => {
    if (!target) return;
    try {
      await cancel.mutateAsync(target.id);
      toast.success('Pengajuan dibatalkan');
    } catch (error) {
      toast.error('Gagal membatalkan pengajuan', { description: getErrorMessage(error) });
      throw error; // dialog tetap terbuka
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Izin & Cuti</h1>
        <Button asChild className="min-h-11">
          <Link href="/app/leave/new">
            <PlusIcon aria-hidden="true" />
            Ajukan
          </Link>
        </Button>
      </div>

      <QuotaCard quota={quota.data} loading={quota.isPending} />

      <Tabs defaultValue="ALL" className="gap-3">
        <TabsList className="grid h-11 w-full grid-cols-4">
          {TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="px-1 text-xs sm:text-sm">
              {label}
              {leaves.data && value !== 'ALL' && byStatus[value].length > 0 ? (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                  {byStatus[value].length}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value, label }) => (
          <TabsContent key={value} value={value} className="space-y-3">
            {leaves.isPending ? (
              Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-32 w-full rounded-2xl" />
              ))
            ) : leaves.isError ? (
              <ErrorState
                className="rounded-2xl border"
                message={getErrorMessage(leaves.error)}
                onRetry={() => void leaves.refetch()}
              />
            ) : byStatus[value].length === 0 ? (
              <EmptyState
                className="rounded-2xl border"
                icon={ClipboardListIcon}
                title={value === 'ALL' ? 'Belum ada pengajuan' : `Tidak ada pengajuan "${label}"`}
                description="Ajukan izin, sakit, atau cuti tahunan dari tombol di bawah."
                action={
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href="/app/leave/new">
                      <PlusIcon aria-hidden="true" />
                      Ajukan sekarang
                    </Link>
                  </Button>
                }
              />
            ) : (
              byStatus[value].map((leave) => (
                <LeaveCard key={leave.id} leave={leave} onCancel={setTarget} />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title="Batalkan pengajuan?"
        description={
          target
            ? `${LEAVE_TYPE_META[target.type].label} ${formatDateShort(target.startDate)}${
                target.startDate === target.endDate ? '' : ` – ${formatDateShort(target.endDate)}`
              } akan dibatalkan dan tidak dapat dikembalikan.`
            : undefined
        }
        confirmLabel="Ya, batalkan"
        cancelLabel="Tidak"
        destructive
        onConfirm={confirmCancel}
      />
    </div>
  );
}
