import { api } from '@/lib/api-client';
import type { PersonalQr, UserProfile } from '@/types';

export const profileKeys = {
  all: ['profile'] as const,
  qr: () => [...profileKeys.all, 'qr'] as const,
};

export const profileApi = {
  /** Token QR personal (berganti tiap `intervalSeconds`, default 60). */
  myQr: () => api.get<PersonalQr>('/users/me/qr'),
  updateMe: (input: { name?: string; phone?: string | null }) =>
    api.patch<UserProfile>('/users/me', input),
  /** Multipart `file` (jpg/png/webp ≤ 2 MB). */
  uploadAvatar: (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return api.post<{ avatarUrl: string }>('/users/me/avatar', form, {
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
  },
};
