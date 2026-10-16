import { api } from '@/lib/api-client';
import type { LeaveQuota, LeaveRequest, LeaveType } from '@/types';

export const leaveKeys = {
  all: ['leave'] as const,
  mine: () => [...leaveKeys.all, 'me'] as const,
  quota: (year: number) => [...leaveKeys.all, 'quota', year] as const,
};

export interface CreateLeaveInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachment?: File | null;
}

export const leaveApi = {
  /** Semua pengajuan milik sendiri (terbaru dulu); filter status dilakukan di client. */
  mine: () => api.get<LeaveRequest[]>('/leave-requests/me'),
  quota: (year: number) => api.get<LeaveQuota>('/leave-requests/me/quota', { year }),
  cancel: (id: string) => api.patch<LeaveRequest>(`/leave-requests/${id}/cancel`),

  /** Multipart `type, startDate, endDate, reason, attachment?` dengan progres upload (0–100). */
  async create(input: CreateLeaveInput, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append('type', input.type);
    form.append('startDate', input.startDate);
    form.append('endDate', input.endDate);
    form.append('reason', input.reason);
    if (input.attachment) form.append('attachment', input.attachment, input.attachment.name);
    return api.post<LeaveRequest>('/leave-requests', form, {
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
  },

  /** Lampiran (endpoint terproteksi) sebagai Blob untuk dibuka di tab baru. */
  async attachment(id: string): Promise<Blob> {
    const response = await api.http.get<Blob>(`/leave-requests/${id}/attachment`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
