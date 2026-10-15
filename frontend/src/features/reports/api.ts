import { api } from '@/lib/api-client';

/** Nama file dari header `Content-Disposition: attachment; filename="..."`. */
function filenameFrom(disposition: unknown, fallback: string): string {
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

export const reportsApi = {
  /** Laporan kehadiran pribadi (PDF) — `GET /reports/me/export?month=&format=pdf`. */
  async downloadMyMonthly(month: string): Promise<string> {
    const response = await api.http.get<Blob>('/reports/me/export', {
      params: { month, format: 'pdf' },
      responseType: 'blob',
    });
    const filename = filenameFrom(
      response.headers['content-disposition'],
      `kehadiran-${month}.pdf`,
    );
    saveBlob(response.data, filename);
    return filename;
  },
};
