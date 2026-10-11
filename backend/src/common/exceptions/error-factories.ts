import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from './business.exception';

export interface FieldError {
  field: string;
  messages: string[];
}

/** 400 VALIDATION_ERROR dengan detail per field (format sama dengan ValidationPipe). */
export function validationError(details: FieldError[]): BusinessException {
  return new BusinessException(ErrorCode.VALIDATION_ERROR, 'Data tidak valid', 400, details);
}

export function fieldError(field: string, message: string): BusinessException {
  return validationError([{ field, messages: [message] }]);
}

/** 409 CONFLICT, opsional dengan detail field yang bentrok. */
export function conflictError(message: string, details?: FieldError[]): BusinessException {
  return new BusinessException(ErrorCode.CONFLICT, message, 409, details);
}

export function notFoundError(message: string): BusinessException {
  return new BusinessException(ErrorCode.NOT_FOUND, message, 404);
}

export function forbiddenError(message?: string): BusinessException {
  return new BusinessException(ErrorCode.FORBIDDEN, message);
}
