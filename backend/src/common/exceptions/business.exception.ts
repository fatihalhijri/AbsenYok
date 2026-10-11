import { HttpException } from '@nestjs/common';
import {
  DEFAULT_ERROR_MESSAGES,
  DEFAULT_ERROR_STATUS,
  ErrorCode,
} from '@/common/constants/error-codes';

/**
 * Error bisnis dengan kode standar. Diubah ke format error API oleh `AllExceptionsFilter`.
 *
 * @example throw new BusinessException(ErrorCode.OUTSIDE_GEOFENCE, 'Anda berada 245 m ...', 422, { distance: 245 })
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string = DEFAULT_ERROR_MESSAGES[code],
    status: number = DEFAULT_ERROR_STATUS[code],
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
