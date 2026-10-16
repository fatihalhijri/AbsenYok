import { api } from '@/lib/api-client';
import type { MonthlyAttendance, MyToday, ScanKioskInput, ScanResult } from '@/types';

export const attendanceKeys = {
  all: ['attendance'] as const,
  mine: () => [...attendanceKeys.all, 'me'] as const,
  today: () => [...attendanceKeys.mine(), 'today'] as const,
  month: (month: string) => [...attendanceKeys.mine(), 'month', month] as const,
};

export const attendanceApi = {
  /** Kartu beranda: status hari ini, shift, libur/cuti, jendela absen. */
  myToday: () => api.get<MyToday>('/attendance/me/today'),
  /** Riwayat satu bulan + ringkasan (`month=YYYY-MM`). */
  myMonth: (month: string) => api.get<MonthlyAttendance>('/attendance/me', { month }),
  /** Scan QR kiosk → absen masuk/pulang otomatis. */
  scan: (input: ScanKioskInput) => api.post<ScanResult>('/attendance/scan', input),
};
