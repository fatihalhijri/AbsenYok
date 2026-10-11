import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import type {
  ApiSuccessResponse,
  PaginatedResult,
  PaginationMeta,
} from '@/common/types/api-response.type';

function isPaginationMeta(value: unknown): value is PaginationMeta {
  if (typeof value !== 'object' || value === null) return false;
  const meta = value as Record<string, unknown>;
  return ['page', 'limit', 'total', 'totalPages'].every((key) => typeof meta[key] === 'number');
}

export function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.items) && isPaginationMeta(candidate.meta);
}

/**
 * Membungkus respons sukses menjadi `{ success: true, data, meta? }`.
 * - `{ items, meta }` dari service → `data: items, meta`
 * - `StreamableFile` (unduhan file) dilewatkan apa adanya
 */
@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<unknown> | StreamableFile> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof StreamableFile) return result;

        if (isPaginatedResult(result)) {
          return { success: true, data: result.items, meta: result.meta };
        }

        return { success: true, data: result ?? null };
      }),
    );
  }
}
