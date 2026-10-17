'use client';

import {
  ChevronDownIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getErrorMessage } from '@/lib/error';
import type { ExportFormat } from '../api';

const FORMAT_META: Record<ExportFormat, { label: string; icon: typeof FileTextIcon }> = {
  xlsx: { label: 'Excel (.xlsx)', icon: FileSpreadsheetIcon },
  pdf: { label: 'PDF', icon: FileTextIcon },
};

/** Unduh file + toast nama file (dari header Content-Disposition) / pesan error server. */
function useExport(onExport: (format: ExportFormat) => Promise<string>) {
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const run = async (format: ExportFormat) => {
    if (pending) return;
    setPending(format);
    try {
      const filename = await onExport(format);
      toast.success('File diunduh', { description: filename });
    } catch (error) {
      toast.error('Gagal mengunduh laporan', { description: getErrorMessage(error) });
    } finally {
      setPending(null);
    }
  };
  return { pending, run };
}

interface ExportProps {
  onExport: (format: ExportFormat) => Promise<string>;
  disabled?: boolean;
}

/** Dua tombol terpisah "Export Excel" & "Export PDF" (halaman laporan). */
export function ExportButtons({ onExport, disabled }: ExportProps) {
  const { pending, run } = useExport(onExport);
  return (
    <div className="flex flex-wrap gap-2">
      {(['xlsx', 'pdf'] as const).map((format) => {
        const Icon = FORMAT_META[format].icon;
        return (
          <Button
            key={format}
            variant="outline"
            className="min-h-10"
            disabled={disabled || pending !== null}
            aria-busy={pending === format}
            onClick={() => void run(format)}
          >
            {pending === format ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <Icon aria-hidden="true" />
            )}
            {pending === format ? 'Menyiapkan…' : `Export ${format === 'xlsx' ? 'Excel' : 'PDF'}`}
          </Button>
        );
      })}
    </div>
  );
}

/** Satu tombol dengan pilihan format (mis. "Export Hari Ini"). */
export function ExportMenu({ onExport, disabled, label }: ExportProps & { label: string }) {
  const { pending, run } = useExport(onExport);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="min-h-10"
          disabled={disabled || pending !== null}
          aria-busy={pending !== null}
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : (
            <DownloadIcon aria-hidden="true" />
          )}
          {pending ? 'Menyiapkan…' : label}
          <ChevronDownIcon className="opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {(['xlsx', 'pdf'] as const).map((format) => {
          const Icon = FORMAT_META[format].icon;
          return (
            <DropdownMenuItem key={format} onSelect={() => void run(format)}>
              <Icon aria-hidden="true" />
              {FORMAT_META[format].label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
