import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/error';

const MAX_RETRIES = 2;

/** Error klien (4xx) tidak akan berubah bila diulang; error jaringan/5xx boleh dicoba lagi. */
const shouldRetry = (failureCount: number, error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
  failureCount < MAX_RETRIES;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
