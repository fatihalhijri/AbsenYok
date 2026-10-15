import { api } from '@/lib/api-client';
import type { Holiday } from '@/types';

export const holidayKeys = {
  all: ['holidays'] as const,
  year: (year: number) => [...holidayKeys.all, 'year', year] as const,
};

export const holidaysApi = {
  /** Semua role boleh membaca (kalender karyawan). Di-cache SW (StaleWhileRevalidate). */
  list: (year: number) => api.get<Holiday[]>('/holidays', { year }),
};
