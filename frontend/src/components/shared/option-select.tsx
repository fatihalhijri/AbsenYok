'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Radix Select tidak menerima `value=""` → sentinel untuk "tanpa pilihan". */
const NONE = '__none__';

interface OptionSelectProps {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: Option[] | undefined;
  /** Label opsi kosong (mis. "Semua departemen" / "Tidak ada"). */
  noneLabel: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}

/** Select dengan opsi "kosong" (null) — dipakai untuk filter tabel & field opsional form. */
export function OptionSelect({
  id,
  value,
  onChange,
  options,
  noneLabel,
  placeholder,
  disabled,
  loading,
  className,
  ...aria
}: OptionSelectProps) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled || loading}
    >
      <SelectTrigger id={id} className={cn('min-h-10 w-full', className)} {...aria}>
        <SelectValue placeholder={loading ? 'Memuat…' : (placeholder ?? noneLabel)} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {(options ?? []).map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
            {option.disabled ? ' (nonaktif)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
