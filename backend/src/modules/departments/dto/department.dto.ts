import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { PARTIAL_REJECT_NULL } from '@/common/validators/is-optional-non-null.validator';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'IT',
    description: 'Disimpan huruf besar; huruf/angka/_/-, 2–20 karakter',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Kode wajib diisi' })
  @Matches(/^[A-Z0-9_-]{2,20}$/, {
    message: 'Kode 2–20 karakter berupa huruf, angka, garis bawah, atau tanda hubung',
  })
  code: string;

  @ApiProperty({ example: 'Teknologi Informasi' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nama wajib diisi' })
  @MinLength(2, { message: 'Nama minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama maksimal 100 karakter' })
  name: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto, PARTIAL_REJECT_NULL) {}

export const DEPARTMENT_SORT_FIELDS = ['code', 'name', 'createdAt'] as const;

export class DepartmentQueryDto extends PaginationQueryDto {}
