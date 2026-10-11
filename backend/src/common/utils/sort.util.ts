import { ErrorCode } from '@/common/constants/error-codes';
import type { SortOrder } from '@/common/dto/pagination-query.dto';
import { BusinessException } from '@/common/exceptions/business.exception';

/**
 * `?sortBy=&sortOrder=` → `orderBy` Prisma, hanya untuk kolom yang diizinkan.
 * Kolom di luar whitelist → 400 VALIDATION_ERROR (mencegah sort pada kolom sensitif).
 */
export function resolveOrderBy<const Field extends string>(
  sortBy: string | undefined,
  sortOrder: SortOrder,
  allowed: readonly Field[],
  fallback: Field,
): Record<Field, SortOrder> {
  const field = sortBy ?? fallback;
  if (!(allowed as readonly string[]).includes(field)) {
    throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Data tidak valid', 400, [
      { field: 'sortBy', messages: [`sortBy harus salah satu dari: ${allowed.join(', ')}`] },
    ]);
  }
  return { [field]: sortOrder } as Record<Field, SortOrder>;
}
