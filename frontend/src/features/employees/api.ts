import { filenameFrom, saveBlob } from '@/features/reports/api';
import { api } from '@/lib/api-client';
import type {
  AttendanceListItem,
  CreateUserInput,
  LeaveRequest,
  Schemas,
  UpdateUserInput,
  User,
} from '@/types';
import type { ListQuery } from '../master/api';

export const employeeKeys = {
  all: ['users'] as const,
  list: (query: ListQuery) => [...employeeKeys.all, 'list', query] as const,
  detail: (id: string) => [...employeeKeys.all, 'detail', id] as const,
  attendance: (id: string, month: string) =>
    [...employeeKeys.all, 'detail', id, 'attendance', month] as const,
  leaves: (id: string) => [...employeeKeys.all, 'detail', id, 'leaves'] as const,
};

export const employeesApi = {
  list: (query: ListQuery) => api.page<User>('/users', query),
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: (input: CreateUserInput) => api.post<User>('/users', input),
  update: (id: string, input: UpdateUserInput) => api.patch<User>(`/users/${id}`, input),
  setStatus: (id: string, isActive: boolean) =>
    api.patch<User>(`/users/${id}/status`, { isActive }),
  resetPassword: (id: string, newPassword: string) =>
    api.post<null>(`/users/${id}/reset-password`, { newPassword }),
  resetDevice: (id: string) => api.post<User>(`/users/${id}/reset-device`),
  remove: (id: string) => api.delete<null>(`/users/${id}`),

  /** Import XLSX: semua baris divalidasi dulu; error → `details: [{ row, field, messages }]`. */
  importXlsx: (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return api.post<Schemas['ImportResultEntity']>('/users/import', form, {
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
  },
  async downloadTemplate(): Promise<string> {
    const response = await api.http.get<Blob>('/users/import/template', { responseType: 'blob' });
    const filename = filenameFrom(
      response.headers['content-disposition'],
      'template-import-karyawan.xlsx',
    );
    saveBlob(response.data, filename);
    return filename;
  },

  /** Absensi satu karyawan dalam rentang tanggal (admin). */
  attendance: (userId: string, dateFrom: string, dateTo: string) =>
    api.page<AttendanceListItem>('/attendance', {
      userId,
      dateFrom,
      dateTo,
      limit: 100,
      sortBy: 'date',
      sortOrder: 'asc',
    }),
  /** Pengajuan izin/cuti satu karyawan (admin), terbaru dulu. */
  leaves: (userId: string) =>
    api.page<LeaveRequest>('/leave-requests', {
      userId,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
};

/** Satu baris error import XLSX (backend `ImportRowError`). */
export interface ImportRowError {
  row: number;
  field: string;
  messages: string[];
}

/** Ambil daftar error per baris dari `ApiError.details` (bentuk lain diabaikan). */
export function importRowErrors(details: unknown): ImportRowError[] {
  if (!Array.isArray(details)) return [];
  return details
    .filter(
      (item): item is ImportRowError =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ImportRowError).row === 'number' &&
        typeof (item as ImportRowError).field === 'string' &&
        Array.isArray((item as ImportRowError).messages),
    )
    .sort((a, b) => a.row - b.row);
}
