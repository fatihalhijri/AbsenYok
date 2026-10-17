import { type LucideIcon, MonitorSmartphoneIcon, PencilLineIcon, QrCodeIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AttendanceMethod } from '@/types';

export const METHOD_META: Record<AttendanceMethod, { label: string; icon: LucideIcon }> = {
  KIOSK_QR: { label: 'QR kiosk', icon: MonitorSmartphoneIcon },
  PERSONAL_QR: { label: 'QR personal', icon: QrCodeIcon },
  MANUAL: { label: 'Manual', icon: PencilLineIcon },
};

/** Satu ikon metode + tooltip; label tetap terbaca screen reader. */
export function MethodIcon({
  method,
  side,
}: {
  method: AttendanceMethod;
  /** "Masuk" / "Pulang". */
  side: string;
}) {
  const { label, icon: Icon } = METHOD_META[method];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="sr-only">
            {side}: {label}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {side}: {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Ikon metode masuk & pulang (pulang hanya bila berbeda atau ada). */
export function MethodIcons({
  checkIn,
  checkOut,
}: {
  checkIn?: AttendanceMethod | null;
  checkOut?: AttendanceMethod | null;
}) {
  if (!checkIn && !checkOut) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {checkIn ? <MethodIcon method={checkIn} side="Masuk" /> : null}
      {checkOut && checkOut !== checkIn ? <MethodIcon method={checkOut} side="Pulang" /> : null}
    </span>
  );
}
