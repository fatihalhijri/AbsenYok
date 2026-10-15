import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { PARTIAL_REJECT_NULL } from '@/common/validators/is-optional-non-null.validator';

export const MAX_BULK_HOLIDAYS = 100;

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-12-25', description: 'Tanggal lokal (YYYY-MM-DD)' })
  @IsCalendarDate()
  date: string;

  @ApiProperty({ example: 'Hari Raya Natal' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nama hari libur wajib diisi' })
  @MinLength(2, { message: 'Nama hari libur minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama hari libur maksimal 100 karakter' })
  name: string;
}

export class UpdateHolidayDto extends PartialType(CreateHolidayDto, PARTIAL_REJECT_NULL) {}

export class BulkCreateHolidayDto {
  @ApiProperty({
    type: [CreateHolidayDto],
    example: [
      { date: '2026-03-20', name: 'Hari Raya Idul Fitri 1447 H' },
      { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H' },
    ],
  })
  @IsArray({ message: 'items harus berupa array' })
  @ArrayMinSize(1, { message: 'items minimal 1 tanggal' })
  @ArrayMaxSize(MAX_BULK_HOLIDAYS, { message: `items maksimal ${MAX_BULK_HOLIDAYS} tanggal` })
  @ValidateNested({ each: true })
  @Type(() => CreateHolidayDto)
  items: CreateHolidayDto[];
}

export class HolidayQueryDto {
  @ApiPropertyOptional({ example: 2026, description: 'Default: tahun berjalan (APP_TIMEZONE)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'year harus bilangan bulat' })
  @Min(2000, { message: 'year minimal 2000' })
  @Max(2100, { message: 'year maksimal 2100' })
  year?: number;
}
