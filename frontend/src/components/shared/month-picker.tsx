'use client';

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dayjs, formatMonth, MONTH_FORMAT } from '@/lib/date';
import { cn } from '@/lib/utils';

interface MonthPickerProps {
  /** Bulan terpilih `YYYY-MM` (format query API `month`). */
  value: string;
  onChange: (month: string) => void;
  /** Batas bulan (`YYYY-MM`), mis. tidak boleh melewati bulan ini. */
  minMonth?: string;
  maxMonth?: string;
  className?: string;
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) => dayjs().month(index).format('MMM'));

const toMonth = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

export function MonthPicker({ value, onChange, minMonth, maxMonth, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));

  const outOfRange = (month: string) =>
    (minMonth !== undefined && month < minMonth) || (maxMonth !== undefined && month > maxMonth);

  const shift = (delta: number) => {
    const next = dayjs(value, MONTH_FORMAT).add(delta, 'month').format(MONTH_FORMAT);
    if (!outOfRange(next)) onChange(next);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="outline"
        size="icon"
        className="size-10"
        aria-label="Bulan sebelumnya"
        disabled={minMonth !== undefined && value <= minMonth}
        onClick={() => shift(-1)}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear(Number(value.slice(0, 4)));
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-h-10 min-w-40 justify-center font-medium">
            <CalendarIcon aria-hidden="true" />
            {formatMonth(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="center">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Tahun sebelumnya"
              disabled={minMonth !== undefined && year <= Number(minMonth.slice(0, 4))}
              onClick={() => setYear((current) => current - 1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <span className="font-semibold tabular-nums" aria-live="polite">
              {year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Tahun berikutnya"
              disabled={maxMonth !== undefined && year >= Number(maxMonth.slice(0, 4))}
              onClick={() => setYear((current) => current + 1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2" role="listbox" aria-label={`Bulan tahun ${year}`}>
            {MONTH_NAMES.map((name, index) => {
              const month = toMonth(year, index);
              const selected = month === value;
              return (
                <Button
                  key={month}
                  role="option"
                  aria-selected={selected}
                  variant={selected ? 'default' : 'ghost'}
                  className="h-11 capitalize"
                  disabled={outOfRange(month)}
                  onClick={() => {
                    onChange(month);
                    setOpen(false);
                  }}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        className="size-10"
        aria-label="Bulan berikutnya"
        disabled={maxMonth !== undefined && value >= maxMonth}
        onClick={() => shift(1)}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
