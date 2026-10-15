'use client';

import { CalendarOffIcon, MapPinIcon, MonitorSmartphoneIcon, StickyNoteIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDateLong, formatMinutes, formatTime } from '@/lib/date';
import type { Attendance, AttendanceStatus, Holiday } from '@/types';
import { METHOD_LABELS } from '../today-status';

interface DayDetailSheetProps {
  date: string | null;
  record: Attendance | undefined;
  holiday: Holiday | undefined;
  /** Bukan hari kerja sesuai shift. */
  offDay: boolean;
  /** Tanggal di masa depan. */
  future: boolean;
  onClose: () => void;
}

/** Bottom sheet detail satu hari (dibuka dari kalender/daftar). */
export function DayDetailSheet({
  date,
  record,
  holiday,
  offDay,
  future,
  onClose,
}: DayDetailSheetProps) {
  return (
    <Sheet open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{date ? formatDateLong(date) : ''}</SheetTitle>
          <SheetDescription>
            {record
              ? 'Detail absensi'
              : holiday
                ? `Libur: ${holiday.name}`
                : future
                  ? 'Belum ada data untuk tanggal ini.'
                  : offDay
                    ? 'Bukan hari kerja Anda.'
                    : 'Tidak ada data absensi.'}
          </SheetDescription>
        </SheetHeader>
        {record ? (
          <div className="space-y-4 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={record.status as AttendanceStatus} />
              {holiday ? (
                <span className="inline-flex items-center gap-1 text-xs text-destructive">
                  <CalendarOffIcon className="size-3.5" aria-hidden="true" />
                  {holiday.name}
                </span>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Item
                label="Jam masuk"
                value={record.checkInAt ? formatTime(record.checkInAt) : '—'}
              />
              <Item
                label="Jam pulang"
                value={record.checkOutAt ? formatTime(record.checkOutAt) : '—'}
              />
              <Item
                label="Terlambat"
                value={record.lateMinutes > 0 ? formatMinutes(record.lateMinutes) : '—'}
              />
              <Item
                label="Pulang cepat"
                value={record.earlyLeaveMinutes > 0 ? formatMinutes(record.earlyLeaveMinutes) : '—'}
              />
              <Item
                label="Total kerja"
                value={record.workMinutes > 0 ? formatMinutes(record.workMinutes) : '—'}
              />
              <Item
                label="Metode"
                value={record.checkInMethod ? METHOD_LABELS[record.checkInMethod] : '—'}
              />
            </dl>
            <ul className="space-y-2 text-sm">
              {record.location ? (
                <Row icon={<MapPinIcon />} label="Lokasi" value={record.location.name} />
              ) : null}
              {record.kiosk ? (
                <Row icon={<MonitorSmartphoneIcon />} label="Kiosk" value={record.kiosk.name} />
              ) : null}
              {record.note ? (
                <Row icon={<StickyNoteIcon />} label="Catatan" value={record.note} />
              ) : null}
            </ul>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
      {icon}
      <span>
        <span className="text-muted-foreground">{label}: </span>
        {value}
      </span>
    </li>
  );
}
