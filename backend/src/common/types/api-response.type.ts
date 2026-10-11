export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  path: string;
  timestamp: string;
}

/** Bentuk yang dikembalikan service untuk endpoint berpaginasi. */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
