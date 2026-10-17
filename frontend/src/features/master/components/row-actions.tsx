'use client';

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Menu aksi baris standar master data: Ubah, (aksi tambahan), Hapus. */
export function RowActions({
  label,
  onEdit,
  onDelete,
  deleteDisabledReason,
  children,
}: {
  label: string;
  onEdit: () => void;
  onDelete?: () => void;
  /** Bila diisi, Hapus dinonaktifkan (mis. masih dipakai karyawan). */
  deleteDisabledReason?: string;
  children?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label={`Aksi untuk ${label}`}>
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon aria-hidden="true" />
          Ubah
        </DropdownMenuItem>
        {children}
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={Boolean(deleteDisabledReason)}
              onSelect={onDelete}
              title={deleteDisabledReason}
            >
              <Trash2Icon aria-hidden="true" />
              {deleteDisabledReason ? `Hapus (${deleteDisabledReason})` : 'Hapus'}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
