import { ValidateIf } from 'class-validator';

/**
 * Field boleh tidak dikirim, tetapi bila dikirim WAJIB valid — termasuk menolak `null`.
 * `@IsOptional()` bawaan class-validator juga melewati `null`, sehingga `{ "name": null }`
 * lolos validasi lalu gagal di Prisma (500). Pakai ini untuk field body yang tidak nullable;
 * field yang memang boleh `null` tetap memakai `@IsOptional()` + `@ValidateIf(notNull)`.
 */
export function IsOptionalNonNull(): PropertyDecorator {
  return ValidateIf((_object: object, value: unknown) => value !== undefined);
}

/** Opsi `PartialType(...)`: field yang diwarisi divalidasi bila dikirim, termasuk `null`. */
export const PARTIAL_REJECT_NULL = { skipNullProperties: false } as const;
