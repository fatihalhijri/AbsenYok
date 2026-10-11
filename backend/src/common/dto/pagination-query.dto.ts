import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;

export type SortOrder = 'asc' | 'desc';

/** Trim teks; string kosong dianggap tidak diisi. */
const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** Query standar daftar: `?page=1&limit=20&sortBy=createdAt&sortOrder=desc&search=`. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page harus berupa bilangan bulat' })
  @Min(1, { message: 'page minimal 1' })
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_LIMIT, default: DEFAULT_PAGE_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit harus berupa bilangan bulat' })
  @Min(1, { message: 'limit minimal 1' })
  @Max(MAX_PAGE_LIMIT, { message: `limit maksimal ${MAX_PAGE_LIMIT}` })
  limit: number = DEFAULT_PAGE_LIMIT;

  /** Nama kolom; setiap modul wajib memvalidasi terhadap daftar kolom yang diizinkan. */
  @ApiPropertyOptional({ example: 'createdAt' })
  @IsOptional()
  @IsString({ message: 'sortBy harus berupa teks' })
  @Matches(/^[A-Za-z][A-Za-z0-9_.]*$/, { message: 'sortBy tidak valid' })
  @MaxLength(50, { message: 'sortBy maksimal 50 karakter' })
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'], { message: 'sortOrder harus asc atau desc' })
  sortOrder: SortOrder = 'desc';

  @ApiPropertyOptional({ example: 'budi' })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'search harus berupa teks' })
  @MaxLength(100, { message: 'search maksimal 100 karakter' })
  search?: string;
}
