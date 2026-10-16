'use client';

import { Loader2Icon, MessageSquareTextIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { formatDateShort } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import type { LeaveRequest } from '@/types';
import { leaveApi } from '../api';
import { LEAVE_TYPE_META } from '../meta';

/** Kartu satu pengajuan: tipe, rentang, hari kerja, status, alasan & catatan admin. */
export function LeaveCard({
  leave,
  onCancel,
}: {
  leave: LeaveRequest;
  onCancel: (leave: LeaveRequest) => void;
}) {
  const meta = LEAVE_TYPE_META[leave.type];
  const Icon = meta.icon;
  const sameDay = leave.startDate === leave.endDate;

  return (
    <article
      className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs"
      data-status={leave.status}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', meta.tone)}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{meta.label}</h3>
          <p className="text-sm text-muted-foreground tabular-nums">
            {sameDay
              ? formatDateShort(leave.startDate)
              : `${formatDateShort(leave.startDate)} – ${formatDateShort(leave.endDate)}`}
            {' · '}
            {leave.totalDays} hari kerja
          </p>
        </div>
        <StatusBadge kind="leave" status={leave.status} />
      </div>

      <p className="text-sm break-words whitespace-pre-line">{leave.reason}</p>

      {leave.reviewNote ? (
        <p className="flex gap-2 rounded-xl bg-muted/70 px-3 py-2 text-sm">
          <MessageSquareTextIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span>
            <span className="font-medium">Catatan admin: </span>
            {leave.reviewNote}
          </span>
        </p>
      ) : null}

      {leave.hasAttachment || leave.status === 'PENDING' ? (
        <div className="flex flex-wrap gap-2">
          {leave.hasAttachment ? <AttachmentButton id={leave.id} /> : null}
          {leave.status === 'PENDING' ? (
            <Button
              variant="outline"
              className="min-h-11 text-destructive hover:text-destructive"
              onClick={() => onCancel(leave)}
            >
              <XIcon aria-hidden="true" />
              Batalkan
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Lampiran ada di endpoint terproteksi → unduh sebagai Blob lalu buka di tab baru. */
function AttachmentButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    // Buka tab lebih dulu (dalam gestur klik) agar tidak diblokir popup blocker.
    const tab = window.open('', '_blank');
    setLoading(true);
    try {
      const blob = await leaveApi.attachment(id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      toast.error('Lampiran tidak dapat dibuka', { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" className="min-h-11" onClick={() => void open()} disabled={loading}>
      {loading ? (
        <Loader2Icon className="animate-spin" aria-hidden="true" />
      ) : (
        <PaperclipIcon aria-hidden="true" />
      )}
      Lihat lampiran
    </Button>
  );
}
