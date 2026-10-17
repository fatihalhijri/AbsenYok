import type { ListQuery } from '@/features/master/api';
import { api } from '@/lib/api-client';
import type {
  Attendance,
  AttendanceDetail,
  AttendanceListItem,
  CorrectAttendanceInput,
  ManualAttendanceInput,
  PersonalScanInput,
  ScanLog,
  ScanResult,
} from '@/types';

/** Batas rentang tanggal daftar absensi & log scan (backend `resolveDateRange`). */
export const MAX_RANGE_DAYS = 92;

/** Prefix `['attendance', 'admin']` — dibedakan dari data milik karyawan (`['attendance', 'me']`). */
export const attendanceAdminKeys = {
  all: ['attendance', 'admin'] as const,
  list: (query: ListQuery) => [...attendanceAdminKeys.all, 'list', query] as const,
  detail: (id: string) => [...attendanceAdminKeys.all, 'detail', id] as const,
  scanLogs: (query: ListQuery) => [...attendanceAdminKeys.all, 'scan-logs', query] as const,
  suspicious: (date: string) => [...attendanceAdminKeys.all, 'suspicious', date] as const,
};

export const attendanceAdminApi = {
  list: (query: ListQuery) => api.page<AttendanceListItem>('/attendance', query),
  detail: (id: string) => api.get<AttendanceDetail>(`/attendance/${id}`),
  correct: (id: string, input: CorrectAttendanceInput) =>
    api.patch<Attendance>(`/attendance/${id}`, input),
  createManual: (input: ManualAttendanceInput) => api.post<Attendance>('/attendance/manual', input),
  scanLogs: (query: ListQuery) => api.page<ScanLog>('/attendance/scan-logs', query),
  /** Mode cadangan: petugas memindai QR personal karyawan. */
  personalScan: (input: PersonalScanInput) =>
    api.post<ScanResult>('/attendance/personal-scan', input),
};
