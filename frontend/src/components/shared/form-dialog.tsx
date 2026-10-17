'use client';

import { Loader2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** `id` elemen `<form>` di dalam `children` (tombol simpan memakai `form={formId}`). */
  formId: string;
  submitLabel?: string;
  pending?: boolean;
  /** Nonaktifkan tombol simpan (mis. input belum valid). */
  submitDisabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** Dialog berisi form + tombol Batal/Simpan; tidak bisa ditutup selama menyimpan. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  formId,
  submitLabel = 'Simpan',
  pending,
  submitDisabled,
  className,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className={cn('max-h-[90dvh] overflow-y-auto sm:max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Batal
          </Button>
          <Button type="submit" form={formId} disabled={pending || submitDisabled}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
