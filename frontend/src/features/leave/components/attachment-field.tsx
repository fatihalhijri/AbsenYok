'use client';

import { CameraIcon, FileTextIcon, Loader2Icon, PaperclipIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { formatBytes } from '@/lib/upload';
import { prepareAttachment } from '../attachment';

interface AttachmentFieldProps {
  value: File | null;
  onChange: (file: File | null) => void;
  required: boolean;
  error?: string;
  /** Pesan validasi lokal (mis. file terlalu besar) — ditampilkan sebagai error field. */
  onError: (message: string | null) => void;
  disabled?: boolean;
}

/** Lampiran izin: pilih file / ambil foto langsung, kompres & validasi di client, preview. */
export function AttachmentField({
  value,
  onChange,
  required,
  error,
  onError,
  disabled,
}: AttachmentFieldProps) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const preview = usePreviewUrl(value);

  const handleFiles = async (files: FileList | null) => {
    const picked = files?.[0];
    if (!picked) return;
    setProcessing(true);
    const result = await prepareAttachment(picked);
    setProcessing(false);
    if (result.ok) {
      onError(null);
      onChange(result.file);
    } else {
      onChange(null);
      onError(result.error);
    }
  };

  const reset = (input: HTMLInputElement | null) => {
    if (input) input.value = ''; // pilih file yang sama lagi tetap memicu onChange
  };

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={`${id}-file`}>
        Lampiran {required ? <span className="text-destructive">(wajib)</span> : '(opsional)'}
      </FieldLabel>
      <FieldDescription>
        {required
          ? 'Sakit lebih dari 1 hari kerja wajib melampirkan surat dokter.'
          : 'Mis. surat dokter atau undangan.'}{' '}
        JPG, PNG, atau PDF, maks 2 MB — foto otomatis dikecilkan.
      </FieldDescription>

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview blob lokal, bukan aset
            <img
              src={preview}
              alt="Pratinjau lampiran"
              className="size-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300">
              <FileTextIcon className="size-7" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" data-testid="attachment-name">
              {value.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatBytes(value.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Hapus lampiran"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || processing}
          >
            {processing ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <PaperclipIcon aria-hidden="true" />
            )}
            Pilih file
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => cameraRef.current?.click()}
            disabled={disabled || processing}
          >
            <CameraIcon aria-hidden="true" />
            Ambil foto
          </Button>
        </div>
      )}

      <input
        ref={fileRef}
        id={`${id}-file`}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        // `hidden`, bukan sr-only: di dalam <Field> anak dipaksa w-full sehingga input absolut
        // sr-only melebarkan halaman (zoom-out di HP). Tetap dipicu lewat tombol di atas.
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          reset(event.target);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        // `hidden`, bukan sr-only: di dalam <Field> anak dipaksa w-full sehingga input absolut
        // sr-only melebarkan halaman (zoom-out di HP). Tetap dipicu lewat tombol di atas.
        className="hidden"
        aria-label="Ambil foto lampiran"
        onChange={(event) => {
          void handleFiles(event.target.files);
          reset(event.target);
        }}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/** Object URL untuk preview gambar; dicabut saat file berganti/unmount. */
function usePreviewUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron dengan file eksternal
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
