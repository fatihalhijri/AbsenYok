import { ParseUUIDPipe } from '@nestjs/common';
import { fieldError } from '@/common/exceptions/error-factories';

/** `@Param('id', ParseIdPipe)` — UUID tidak valid → 400 VALIDATION_ERROR pada field `id`. */
export const ParseIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => fieldError('id', 'ID harus berupa UUID yang valid'),
});
