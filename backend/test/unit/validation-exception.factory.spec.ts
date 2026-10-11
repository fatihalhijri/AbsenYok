import { ValidationError } from 'class-validator';
import { ErrorCode } from '@/common/constants/error-codes';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from '@/common/pipes/validation-exception.factory';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
) => Object.assign(new ValidationError(), { property, constraints, children });

describe('validationExceptionFactory', () => {
  it('meratakan error nested menjadi daftar per field', () => {
    const errors = [
      error('email', { isEmail: 'Format email tidak valid' }),
      error('address', undefined, [error('city', { isNotEmpty: 'Kota wajib diisi' })]),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'email', messages: ['Format email tidak valid'] },
      { field: 'address.city', messages: ['Kota wajib diisi'] },
    ]);
  });

  it('menghasilkan BusinessException VALIDATION_ERROR 400', () => {
    const exception = validationExceptionFactory([error('page', { min: 'page minimal 1' })]);

    expect(exception.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(exception.getStatus()).toBe(400);
    expect(exception.details).toEqual([{ field: 'page', messages: ['page minimal 1'] }]);
  });
});
