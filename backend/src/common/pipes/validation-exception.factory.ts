import type { ValidationError } from '@nestjs/common';
import { BusinessException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

export interface ValidationErrorDetail {
  field: string;
  messages: string[];
}

/** Meratakan error class-validator (termasuk nested) menjadi daftar per field, mis. `address.city`. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own: ValidationErrorDetail[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    const nested = error.children?.length ? flattenValidationErrors(error.children, field) : [];
    return [...own, ...nested];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BusinessException {
  return new BusinessException(
    ErrorCode.VALIDATION_ERROR,
    'Data tidak valid',
    400,
    flattenValidationErrors(errors),
  );
}
