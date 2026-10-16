'use client';

import { CameraIcon, UserIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { initialsOf } from '@/components/layout/user-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getErrorMessage } from '@/lib/error';
import { AVATAR_TYPES, validateUpload } from '@/lib/upload';
import type { UserProfile } from '@/types';
import { useUploadAvatar } from '../hooks';
import { AvatarCropDialog } from './avatar-crop-dialog';

/** Avatar (ubah foto → crop persegi → upload), nama, NIP, jabatan, departemen. */
export function ProfileHeader({ user }: { user: UserProfile }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const upload = useUploadAvatar(setProgress);

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Pilih file gambar (JPG, PNG, atau WebP)');
      return;
    }
    setPicked(file);
  };

  const onConfirm = async (cropped: File) => {
    const error = validateUpload(cropped, { types: AVATAR_TYPES, label: 'JPG, PNG, atau WebP' });
    if (error) {
      toast.error(error);
      return;
    }
    setProgress(0);
    try {
      await upload.mutateAsync(cropped);
      toast.success('Foto profil diperbarui');
      setPicked(null);
    } catch (uploadError) {
      toast.error('Gagal mengunggah foto', { description: getErrorMessage(uploadError) });
    }
  };

  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <Avatar className="size-24 text-2xl shadow-md ring-4 ring-background">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={`Foto ${user.name}`} /> : null}
          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
            {initialsOf(user.name) || <UserIcon className="size-8" aria-hidden="true" />}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Ubah foto profil"
          className="absolute -right-1 -bottom-1 flex size-11 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CameraIcon className="size-4" aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <div className="space-y-0.5">
        <h1 className="text-xl font-semibold">{user.name}</h1>
        <p className="text-sm text-muted-foreground tabular-nums">NIP {user.employeeCode}</p>
        <p className="text-sm text-muted-foreground">
          {[user.position, user.department?.name].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <AvatarCropDialog
        file={picked}
        onCancel={() => setPicked(null)}
        onConfirm={onConfirm}
        progress={upload.isPending ? progress : undefined}
      />
    </section>
  );
}
