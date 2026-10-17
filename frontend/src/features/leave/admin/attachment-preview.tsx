'use client';

import { ExternalLinkIcon, Loader2Icon, PaperclipIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/error';
import type { LeaveRequest } from '@/types';
import { leaveApi } from '../api';

type Preview = { kind: 'image' | 'pdf'; url: string };

/**
 * Buka URL di tab baru; `false` bila diblokir. (Tanpa fitur `noopener` karena dengan itu
 * `window.open` selalu mengembalikan null — opener diputus manual.)
 */
function openInNewTab(url: string): boolean {
  const tab = window.open(url, '_blank');
  if (!tab) return false;
  tab.opener = null;
  return true;
}

/**
 * Tombol lampiran: file diunduh lewat endpoint terproteksi (token ikut di klien API) sebagai Blob.
 * Gambar → pratinjau di dialog; PDF → dibuka di tab baru (bila diblokir browser, tombol "Buka PDF"
 * di dialog memakai klik pengguna).
 */
export function AttachmentButton({ leave }: { leave: LeaveRequest }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);

  // Object URL dicabut saat diganti / komponen dilepas.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const show = async () => {
    if (preview) {
      if (preview.kind === 'pdf' && openInNewTab(preview.url)) return;
      setOpen(true);
      return;
    }
    setLoading(true);
    try {
      const blob = await leaveApi.attachment(leave.id);
      const next: Preview = {
        kind: blob.type === 'application/pdf' ? 'pdf' : 'image',
        url: URL.createObjectURL(blob),
      };
      setPreview(next);
      if (next.kind === 'pdf' && openInNewTab(next.url)) return;
      setOpen(true);
    } catch (error) {
      toast.error('Gagal membuka lampiran', { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-9"
        onClick={() => void show()}
        disabled={loading}
        aria-label={`Lihat lampiran ${leave.user.name}`}
      >
        {loading ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <PaperclipIcon aria-hidden="true" />
        )}
        Lampiran
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lampiran {leave.user.name}</DialogTitle>
            <DialogDescription>
              {preview?.kind === 'pdf'
                ? 'Browser memblokir tab baru. Buka PDF lewat tombol di bawah.'
                : 'Pratinjau lampiran pengajuan.'}
            </DialogDescription>
          </DialogHeader>
          {preview?.kind === 'image' ? (
            // Blob URL lokal — next/image tidak diperlukan (tidak dioptimasi server).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={`Lampiran pengajuan ${leave.user.name}`}
              className="max-h-[70dvh] w-full rounded-lg bg-muted object-contain"
            />
          ) : preview ? (
            <Button asChild className="w-fit">
              <a href={preview.url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon aria-hidden="true" />
                Buka PDF di tab baru
              </a>
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
