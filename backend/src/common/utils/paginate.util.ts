import type { PaginatedResult } from '@/common/types/api-response.type';

export interface PageParams {
  page: number;
  limit: number;
}

/** Konversi page/limit ke `skip`/`take` Prisma. */
export function toSkipTake({ page, limit }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

/** Bentuk hasil berpaginasi standar; dibungkus interceptor menjadi `data` + `meta`. */
export function paginate<T>(
  items: T[],
  total: number,
  { page, limit }: PageParams,
): PaginatedResult<T> {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
