import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/lib/env';
import { ApiError, toApiError } from '@/lib/error';
import { type AuthSession, type AuthStore, useAuthStore } from '@/stores/auth-store';

const TIMEOUT_MS = 15_000;
const REFRESH_PATH = '/auth/refresh';
/** Endpoint yang tidak boleh memicu refresh otomatis (mencegah loop). */
const NO_REFRESH_PATHS = ['/auth/login', REFRESH_PATH, '/auth/logout'];
const REFRESH_LOCK = 'absenyok-auth-refresh';

/** Respons sukses standar backend. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** Dipanggil saat sesi tidak bisa dipulihkan (refresh ditolak) — biasanya redirect ke login. */
export type SessionExpiredHandler = (nextPath: string | null) => void;

/**
 * Bawaan: tidak melakukan apa-apa — store sudah dikosongkan sehingga RoleGate mengalihkan ke
 * login. AuthBootstrap mendaftarkan handler berbasis router (`setSessionExpiredHandler`).
 */
const noopSessionExpiredHandler: SessionExpiredHandler = () => undefined;

const currentPath = () =>
  typeof window === 'undefined' ? null : `${window.location.pathname}${window.location.search}`;

/**
 * Jalankan `task` secara eksklusif lintas tab (Web Locks API). Refresh token dirotasi setiap
 * dipakai dan pemakaian ulang token lama dianggap pencurian (seluruh sesi dicabut), sehingga dua
 * tab tidak boleh me-refresh bersamaan dengan cookie yang sama. Tanpa dukungan Web Locks → langsung.
 */
async function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return task();
  return locks.request(REFRESH_LOCK, task);
}

interface CreateApiClientOptions {
  baseURL: string;
  store: Pick<AuthStore, 'getState'>;
}

export function createApiClient({ baseURL, store }: CreateApiClientOptions) {
  let onSessionExpired: SessionExpiredHandler = noopSessionExpiredHandler;
  let inflightRefresh: Promise<AuthSession> | null = null;

  const base = { baseURL, withCredentials: true, timeout: TIMEOUT_MS };
  /** Instance terpisah tanpa interceptor untuk refresh (tidak ikut mencoba refresh ulang). */
  const refreshHttp = axios.create(base);
  const http: AxiosInstance = axios.create(base);

  /**
   * Pulihkan/perbarui sesi lewat cookie refresh httpOnly. Single-flight: semua pemanggil yang
   * datang selagi refresh berjalan menunggu promise yang sama → hanya 1 request `/auth/refresh`.
   */
  function refreshSession(): Promise<AuthSession> {
    inflightRefresh ??= runExclusive(async () => {
      const response = await refreshHttp.post<ApiSuccess<AuthSession>>(REFRESH_PATH);
      const session = response.data.data;
      store.getState().setSession(session);
      return session;
    })
      .catch((error: unknown) => {
        throw toApiError(error);
      })
      .finally(() => {
        inflightRefresh = null;
      });
    return inflightRefresh;
  }

  http.interceptors.request.use((config) => {
    const token = store.getState().accessToken;
    if (token && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  http.interceptors.response.use(undefined, async (error: unknown) => {
    const apiError = toApiError(error);
    const config = (axios.isAxiosError(error) ? error.config : undefined) as
      RetriableConfig | undefined;

    const canRefresh =
      apiError.status === 401 &&
      apiError.code === 'TOKEN_EXPIRED' &&
      config !== undefined &&
      !config._retried &&
      !NO_REFRESH_PATHS.some((path) => config.url?.endsWith(path));
    if (!canRefresh) throw apiError;

    let session: AuthSession;
    try {
      session = await refreshSession();
    } catch (refreshError) {
      const failure = toApiError(refreshError);
      // Hanya penolakan sesi (401/403) yang mengakhiri sesi; offline/timeout/5xx bisa dicoba lagi.
      if (failure.isAuthRejection) {
        // Request paralel gagal bersamaan → hanya yang pertama (sesi masih ada) yang mengalihkan.
        const hadSession = store.getState().accessToken !== null;
        store.getState().clear();
        if (hadSession) onSessionExpired(currentPath());
      }
      throw failure;
    }

    config._retried = true;
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
    return http.request(config);
  });

  /** Request lalu unwrap `body.data`. */
  async function request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await http.request<ApiSuccess<T>>(config);
    return response.data.data;
  }

  return {
    http,
    refreshSession,
    setSessionExpiredHandler(handler: SessionExpiredHandler) {
      onSessionExpired = handler;
    },
    get: <T>(url: string, params?: object, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'GET', url, params }),
    post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'POST', url, data }),
    patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'PATCH', url, data }),
    put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'PUT', url, data }),
    delete: <T>(url: string, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'DELETE', url }),
    /** Listing berpaginasi: `{ items: data, meta }`. */
    async page<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<Page<T>> {
      const response = await http.request<ApiSuccess<T[]>>({
        ...config,
        method: 'GET',
        url,
        params,
      });
      const meta = response.data.meta;
      if (!meta) {
        throw new ApiError({
          code: 'INVALID_RESPONSE',
          message: 'Respons server tidak memuat informasi halaman.',
          status: response.status,
        });
      }
      return { items: response.data.data, meta };
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Klien API aplikasi (baseURL relatif → lewat proxy Next.js ke backend). */
export const api = createApiClient({ baseURL: env.NEXT_PUBLIC_API_BASE, store: useAuthStore });
