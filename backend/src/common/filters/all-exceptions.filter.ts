import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '@/config/app.config';
import {
  DEFAULT_ERROR_MESSAGES,
  DEFAULT_ERROR_STATUS,
  ErrorCode,
} from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { ApiErrorBody, ApiErrorResponse } from '@/common/types/api-response.type';

interface ResolvedError {
  status: number;
  body: ApiErrorBody;
}

/** Bentuk minimal `Prisma.PrismaClientKnownRequestError` (dideteksi tanpa meng-import client). */
interface PrismaKnownRequestErrorLike extends Error {
  code: string;
  meta?: Record<string, unknown>;
}

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.TOKEN_INVALID,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

/** Pesan khusus untuk status yang tidak punya kode sendiri (mis. dari body-parser/multer). */
const STATUS_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Metode tidak diizinkan',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Ukuran data terlalu besar',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Tipe konten tidak didukung',
};

export function isPrismaKnownRequestError(error: unknown): error is PrismaKnownRequestErrorLike {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    typeof (error as Partial<PrismaKnownRequestErrorLike>).code === 'string'
  );
}

/**
 * Filter global: semua error diubah ke format
 * `{ success: false, error: { code, message, details? }, path, timestamp }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${status} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (response.headersSent) return;

    const payload: ApiErrorResponse = {
      success: false,
      error: body,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(payload);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof BusinessException) {
      return {
        status: exception.getStatus(),
        body: this.body(exception.code, exception.message, exception.details),
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (isPrismaKnownRequestError(exception)) {
      const prismaError = this.fromPrismaError(exception);
      if (prismaError) return prismaError;
    }

    return this.internalError(exception);
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const code =
      STATUS_TO_CODE[status] ?? (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST);
    const message = STATUS_MESSAGES[status] ?? DEFAULT_ERROR_MESSAGES[code];

    // Detail hanya diteruskan untuk 503 (mis. hasil health check terminus per indikator).
    const response = exception.getResponse();
    const details =
      exception instanceof ServiceUnavailableException && typeof response === 'object'
        ? response
        : undefined;

    return { status, body: this.body(code, message, details) };
  }

  private fromPrismaError(error: PrismaKnownRequestErrorLike): ResolvedError | null {
    switch (error.code) {
      case 'P2002': {
        const target = error.meta?.target;
        return {
          status: DEFAULT_ERROR_STATUS[ErrorCode.CONFLICT],
          body: this.body(
            ErrorCode.CONFLICT,
            DEFAULT_ERROR_MESSAGES[ErrorCode.CONFLICT],
            target === undefined ? undefined : { target },
          ),
        };
      }
      case 'P2025':
        return {
          status: DEFAULT_ERROR_STATUS[ErrorCode.NOT_FOUND],
          body: this.body(ErrorCode.NOT_FOUND, DEFAULT_ERROR_MESSAGES[ErrorCode.NOT_FOUND]),
        };
      default:
        return null;
    }
  }

  private internalError(exception: unknown): ResolvedError {
    const details =
      !this.config.isProduction && exception instanceof Error
        ? { name: exception.name, message: exception.message, stack: exception.stack }
        : undefined;

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: this.body(
        ErrorCode.INTERNAL_ERROR,
        DEFAULT_ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR],
        details,
      ),
    };
  }

  private body(code: string, message: string, details?: unknown): ApiErrorBody {
    return details === undefined ? { code, message } : { code, message, details };
  }
}
