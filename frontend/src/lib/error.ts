import { isAxiosError } from 'axios';

/** Detail validasi per field dari backend (`VALIDATION_ERROR`). */
export interface FieldErrorDetail {
  field: string;
  messages: string[];
}

/** Bentuk error standar backend: `{ success: false, error: { code, message, details? } }`. */
interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

const NETWORK_MESSAGE = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
const TIMEOUT_MESSAGE = 'Server terlalu lama merespons. Silakan coba lagi.';
const UNKNOWN_MESSAGE = 'Terjadi kesalahan. Silakan coba lagi.';

/** Error dari API (atau jaringan) dengan kode & pesan dari backend. */
export class ApiError extends Error {
  readonly code: string;
  /** HTTP status; `0` bila tidak ada respons (offline/timeout). */
  readonly status: number;
  readonly details?: unknown;

  constructor({
    code,
    message,
    status,
    details,
  }: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Tidak ada respons dari server (offline, DNS, CORS, timeout). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Sesi ditolak server (refresh token tidak valid/dicabut) — bukan gangguan server/jaringan. */
  get isAuthRejection(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Detail validasi per field bila `details` berbentuk `[{ field, messages }]`. */
  get fieldErrors(): FieldErrorDetail[] {
    return Array.isArray(this.details)
      ? this.details.filter(
          (item): item is FieldErrorDetail =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as FieldErrorDetail).field === 'string' &&
            Array.isArray((item as FieldErrorDetail).messages),
        )
      : [];
  }
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as ApiErrorBody).success === false &&
    typeof (data as ApiErrorBody).error?.code === 'string'
  );
}

/** Ubah error apa pun (axios, jaringan, lainnya) menjadi `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data: unknown = error.response?.data;
    if (isApiErrorBody(data)) {
      return new ApiError({ ...data.error, status });
    }
    if (!error.response) {
      const timeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      return new ApiError({
        code: timeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: timeout ? TIMEOUT_MESSAGE : NETWORK_MESSAGE,
        status: 0,
      });
    }
    return new ApiError({ code: `HTTP_${status}`, message: UNKNOWN_MESSAGE, status });
  }
  return new ApiError({ code: 'UNKNOWN', message: UNKNOWN_MESSAGE, status: 0 });
}

/** Pesan yang aman ditampilkan ke user (toast/alert). */
export function getErrorMessage(error: unknown): string {
  return toApiError(error).message;
}
