import { api } from '@/lib/api-client';
import type { MonthlyReport } from '@/types';

export type ExportFormat = 'xlsx' | 'pdf';

export const reportKeys = {
  all: ['reports'] as const,
  monthly: (month: string, departmentId: string | null) =>
    [...reportKeys.all, 'monthly', month, departmentId] as const,
};

/** Nama file dari header `Content-Disposition: attachment; filename="..."`. */
export function filenameFrom(disposition: unknown, fallback: string): string {
  if (typeof disposition !== 'string') return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

/** Simpan Blob sebagai file lewat tautan sementara. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Beri waktu browser memulai unduhan sebelum URL dicabut.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Unduh file terproteksi (token ikut lewat klien API) → simpan dengan nama dari server. */
async function download(url: string, params: object, fallback: string): Promise<string> {
  const response = await api.http.get<Blob>(url, { params, responseType: 'blob' });
  const filename = filenameFrom(response.headers['content-disposition'], fallback);
  saveBlob(response.data, filename);
  return filename;
}

export const reportsApi = {
  /** Rekap per karyawan satu bulan (`month=YYYY-MM`, opsional per departemen). */
  monthly: (month: string, departmentId?: string | null) =>
    api.get<MonthlyReport>('/reports/monthly', {
      month,
      ...(departmentId ? { departmentId } : {}),
    }),
  downloadMonthly: (month: string, format: ExportFormat, departmentId?: string | null) =>
    download(
      '/reports/monthly/export',
      { month, format, ...(departmentId ? { departmentId } : {}) },
      `rekap-absensi-${month}.${format}`,
    ),
  downloadDaily: (date: string, format: ExportFormat) =>
    download('/reports/daily/export', { date, format }, `absensi-harian-${date}.${format}`),
  /** Laporan kehadiran pribadi (PDF) — `GET /reports/me/export?month=&format=pdf`. */
  downloadMyMonthly: (month: string) =>
    download('/reports/me/export', { month, format: 'pdf' }, `kehadiran-${month}.pdf`),
};
