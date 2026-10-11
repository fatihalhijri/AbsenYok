import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { DEFAULT_ERROR_MESSAGES, ErrorCode } from '@/common/constants/error-codes';

interface DataResponseOptions {
  status?: HttpStatus.OK | HttpStatus.CREATED;
  description?: string;
  isArray?: boolean;
}

/** Respons sukses `{ success: true, data: <Model> }` (atau `data: Model[]`). */
export function ApiDataResponse(model: Type<unknown>, options: DataResponseOptions = {}) {
  const { status = HttpStatus.OK, description = 'Berhasil', isArray = false } = options;
  const data = isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: { success: { type: 'boolean', example: true }, data },
      },
    }),
  );
}

/** Respons daftar berpaginasi `{ success, data: Model[], meta }`. */
export function ApiPaginatedResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Daftar berpaginasi',
      schema: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 45 },
              totalPages: { type: 'integer', example: 3 },
            },
          },
        },
      },
    }),
  );
}

/** Respons sukses tanpa data `{ success: true, data: null }`. */
export function ApiNullDataResponse(description = 'Berhasil') {
  return ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: { example: { success: true, data: null } },
  });
}

/** Contoh respons error standar untuk satu kode error. */
export function ApiErrorResponse(status: number, code: ErrorCode, description?: string) {
  return ApiResponse({
    status,
    description: description ?? DEFAULT_ERROR_MESSAGES[code],
    schema: {
      example: {
        success: false,
        error: { code, message: DEFAULT_ERROR_MESSAGES[code] },
        path: '/api/v1/...',
        timestamp: '2026-10-11T01:05:22.000Z',
      },
    },
  });
}

/** Error umum endpoint terautentikasi: 400 validasi, 401 token, 403 akses. */
export function ApiStandardErrors() {
  return applyDecorators(
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Data tidak valid',
      schema: {
        example: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: [{ field: 'name', messages: ['Nama wajib diisi'] }],
          },
          path: '/api/v1/...',
          timestamp: '2026-10-11T01:05:22.000Z',
        },
      },
    }),
    ApiErrorResponse(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.TOKEN_INVALID,
      'Token tidak ada/tidak valid (TOKEN_INVALID) atau kedaluwarsa (TOKEN_EXPIRED)',
    ),
    ApiErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN),
  );
}
