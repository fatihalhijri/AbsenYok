'use client';

import {
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getErrorMessage, toApiError } from '@/lib/error';
import { useToastMutation } from '@/lib/mutation';
import { formatBytes } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { employeeKeys, employeesApi, type ImportRowError, importRowErrors } from '../api';

/** Batas backend (`IMPORT_MAX_BYTES`). */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const FIELD_LABELS: Record<string, string> = {
  employeeCode: 'NIP',
  name: 'Nama',
  email: 'Email',
  phone: 'Telepon',
  position: 'Jabatan',
  password: 'Password',
  departmentCode: 'Kode departemen',
  shiftName: 'Nama shift',
  file: 'File',
};

type Result =
  | { kind: 'success'; imported: number }
  | { kind: 'invalid'; message: string; rows: ImportRowError[] };

/** Pilih file XLSX lokal: hanya .xlsx ≤ 5 MB (dicek sebelum upload). */
export function validateImportFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const isXlsx = file.type === XLSX_MIME || file.name.toLowerCase().endsWith('.xlsx');
  if (!isXlsx) return 'File harus berformat .xlsx (gunakan template)';
  if (file.size > MAX_IMPORT_BYTES) {
    return `Ukuran file ${formatBytes(file.size)} — maksimal ${formatBytes(MAX_IMPORT_BYTES)}`;
  }
  return null;
}

/** Import karyawan dari XLSX: unduh template, drag & drop, lalu ringkasan sukses / error per baris. */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [downloading, setDownloading] = useState(false);

  const upload = useToastMutation({
    mutationFn: (selected: File) => employeesApi.importXlsx(selected, setProgress),
    invalidate: [employeeKeys.all],
    success: ({ imported }) => `${imported} karyawan berhasil diimpor`,
    error: false,
  });

  const reset = () => {
    setFile(null);
    setFileError(null);
    setResult(null);
    setProgress(0);
  };

  const pick = (selected: File | undefined) => {
    if (!selected) return;
    setResult(null);
    const error = validateImportFile(selected);
    setFileError(error);
    setFile(error ? null : selected);
  };

  const start = async () => {
    if (!file) return;
    setProgress(0);
    try {
      const { imported } = await upload.mutateAsync(file);
      setResult({ kind: 'success', imported });
      setFile(null);
    } catch (error) {
      const apiError = toApiError(error);
      const rows = importRowErrors(apiError.details);
      if (rows.length > 0 || apiError.status === 400) {
        setResult({ kind: 'invalid', message: apiError.message, rows });
      } else {
        toast.error('Import gagal', { description: getErrorMessage(error) });
      }
    }
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      await employeesApi.downloadTemplate();
    } catch (error) {
      toast.error('Gagal mengunduh template', { description: getErrorMessage(error) });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (upload.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import karyawan (XLSX)</DialogTitle>
          <DialogDescription>
            Semua baris divalidasi lebih dulu. Bila ada satu baris salah, tidak ada data yang
            disimpan — perbaiki lalu unggah ulang. Maksimal 500 baris / 5 MB. Karyawan hasil import
            berrole Karyawan.
          </DialogDescription>
        </DialogHeader>

        <Button
          variant="outline"
          className="w-fit"
          onClick={() => void downloadTemplate()}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : (
            <DownloadIcon aria-hidden="true" />
          )}
          Unduh template
        </Button>

        <div
          role="button"
          tabIndex={0}
          aria-label="Pilih atau jatuhkan file XLSX"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files[0]);
          }}
          data-testid="import-dropzone"
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors outline-none',
            'hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50',
            dragging ? 'border-primary bg-primary/5' : 'border-border',
          )}
        >
          {file ? (
            <>
              <FileSpreadsheetIcon className="size-10 text-primary" aria-hidden="true" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatBytes(file.size)} · klik untuk ganti
              </p>
            </>
          ) : (
            <>
              <UploadCloudIcon className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">Seret & jatuhkan file .xlsx di sini</p>
              <p className="text-sm text-muted-foreground">atau klik untuk memilih file</p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {fileError ? (
          <p className="text-sm text-destructive" role="alert">
            {fileError}
          </p>
        ) : null}

        {upload.isPending ? (
          <div className="space-y-1" role="status" aria-live="polite">
            <Progress value={progress} className="h-2" aria-label="Progres unggah" />
            <p className="text-xs text-muted-foreground tabular-nums">
              {progress < 100 ? `Mengunggah… ${progress}%` : 'Memvalidasi baris…'}
            </p>
          </div>
        ) : null}

        {result?.kind === 'success' ? (
          <div
            className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4"
            role="status"
          >
            <CheckCircle2Icon className="size-6 text-success" aria-hidden="true" />
            <p className="font-medium">{result.imported} karyawan berhasil diimpor.</p>
          </div>
        ) : null}

        {result?.kind === 'invalid' ? (
          <div className="space-y-2" role="alert" data-testid="import-errors">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <XCircleIcon className="size-5" aria-hidden="true" />
              {result.rows.length > 0
                ? `${new Set(result.rows.map((row) => row.row)).size} baris tidak valid — tidak ada data yang disimpan.`
                : result.message}
            </p>
            {result.rows.length > 0 ? (
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-20">Baris</TableHead>
                      <TableHead className="w-32">Kolom</TableHead>
                      <TableHead>Masalah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, index) => (
                      <TableRow key={`${row.row}-${row.field}-${index}`}>
                        <TableCell className="tabular-nums">{row.row}</TableCell>
                        <TableCell>{FIELD_LABELS[row.field] ?? row.field}</TableCell>
                        <TableCell className="whitespace-normal">
                          {row.messages.join('; ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={upload.isPending}
          >
            Tutup
          </Button>
          <Button onClick={() => void start()} disabled={!file || upload.isPending}>
            {upload.isPending ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloudIcon aria-hidden="true" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
