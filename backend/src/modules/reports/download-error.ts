import type { Response } from 'express';
import { DEFAULT_ERROR_MESSAGES, ErrorCode } from '@/common/constants/error-codes';
import type { ApiErrorResponse } from '@/common/types/api-response.type';

/**
 * Penanganan error saat file laporan di-stream (pengganti handler bawaan `StreamableFile`
 * yang mengirim pesan error mentah dengan status 400, atau menutup respons dengan normal
 * sehingga klien menyimpan file terpotong berstatus 200).
 * - Header belum terkirim → 500 dengan format error standar (tanpa detail internal).
 * - Sebagian file sudah terkirim → koneksi diputus agar unduhan GAGAL, bukan file rusak.
 */
export function failDownload(response: Response): void {
  if (response.destroyed) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }

  // Header file (type/disposition) sudah diset StreamableFile; ganti dengan respons JSON.
  response.removeHeader('Content-Type');
  response.removeHeader('Content-Disposition');
  response.removeHeader('Content-Length');
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: DEFAULT_ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR],
    },
    path: response.req.originalUrl,
    timestamp: new Date().toISOString(),
  };
  response.status(500).json(body);
}
