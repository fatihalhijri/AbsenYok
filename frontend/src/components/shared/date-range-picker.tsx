'use client';

import { CalendarRangeIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { id } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { dateToString, formatDateShort, stringToDate } from '@/lib/date';
import { cn } from '@/lib/utils';

/** Rentang tanggal kalender `YYYY-MM-DD` (format query API: dateFrom/dateTo). */
export interface DateRangeValue {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRangeValue | null;
  onChange: (value: DateRangeValue | null) => void;
  placeholder?: string;
  /** Batas tanggal yang bisa dipilih (`YYYY-MM-DD`). */
  minDate?: string;
  maxDate?: string;
  /** Tampilkan tombol hapus pilihan. */
  clearable?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Pilih rentang tanggal',
  minDate,
  maxDate,
  clearable = true,
  className,
  ...props
}: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // Pilihan sementara: rentang baru dikirim setelah tanggal akhir dipilih.
  const [draft, setDraft] = useState<DayPickerRange | undefined>();

  const selected: DayPickerRange | undefined =
    draft ?? (value ? { from: stringToDate(value.from), to: stringToDate(value.to) } : undefined);

  const label = value
    ? value.from === value.to
      ? formatDateShort(value.from)
      : `${formatDateShort(value.from)} – ${formatDateShort(value.to)}`
    : placeholder;

  const handleSelect = (range: DayPickerRange | undefined) => {
    if (range?.from && range.to && draft?.from) {
      onChange({ from: dateToString(range.from), to: dateToString(range.to) });
      setDraft(undefined);
      setOpen(false);
      return;
    }
    setDraft(range?.from ? { from: range.from, to: undefined } : undefined);
  };

  const disabled = [
    ...(minDate ? [{ before: stringToDate(minDate) }] : []),
    ...(maxDate ? [{ after: stringToDate(maxDate) }] : []),
  ];

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDraft(undefined);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('min-h-10 justify-start font-normal', !value && 'text-muted-foreground')}
            aria-label={props['aria-label'] ?? 'Rentang tanggal'}
          >
            <CalendarRangeIcon aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            locale={id}
            numberOfMonths={isMobile ? 1 : 2}
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected?.from}
            disabled={disabled}
            className="[--cell-size:--spacing(9)]"
          />
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            {draft?.from ? 'Pilih tanggal akhir' : 'Pilih tanggal awal'}
          </p>
        </PopoverContent>
      </Popover>
      {clearable && value ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label="Hapus rentang tanggal"
          onClick={() => onChange(null)}
        >
          <XIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
