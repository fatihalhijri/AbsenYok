import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'harus berformat HH:mm (00:00–23:59)';

export class CreateShiftDto {
  @ApiProperty({ example: 'Reguler' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nama shift wajib diisi' })
  @MinLength(2, { message: 'Nama shift minimal 2 karakter' })
  @MaxLength(50, { message: 'Nama shift maksimal 50 karakter' })
  name: string;

  @ApiProperty({ example: '08:00' })
  @IsString({ message: `Jam masuk ${TIME_MESSAGE}` })
  @Matches(TIME_PATTERN, { message: `Jam masuk ${TIME_MESSAGE}` })
  startTime: string;

  @ApiProperty({
    example: '17:00',
    description: 'Harus setelah jam masuk (shift lintas tengah malam tidak didukung)',
  })
  @IsString({ message: `Jam pulang ${TIME_MESSAGE}` })
  @Matches(TIME_PATTERN, { message: `Jam pulang ${TIME_MESSAGE}` })
  endTime: string;

  @ApiPropertyOptional({ example: 15, minimum: 0, maximum: 120, default: 15 })
  @IsOptional()
  @IsInt({ message: 'Toleransi terlambat harus bilangan bulat' })
  @Min(0, { message: 'Toleransi terlambat minimal 0 menit' })
  @Max(120, { message: 'Toleransi terlambat maksimal 120 menit' })
  lateToleranceMinutes?: number;

  @ApiPropertyOptional({
    example: 60,
    minimum: 0,
    maximum: 240,
    default: 60,
    description: 'Absen masuk dibuka sekian menit sebelum jam masuk',
  })
  @IsOptional()
  @IsInt({ message: 'Waktu buka absen harus bilangan bulat' })
  @Min(0, { message: 'Waktu buka absen minimal 0 menit' })
  @Max(240, { message: 'Waktu buka absen maksimal 240 menit' })
  checkInOpenMinutes?: number;

  @ApiPropertyOptional({
    example: '1,2,3,4,5',
    default: '1,2,3,4,5',
    description: 'ISO weekday dipisah koma: 1 = Senin … 7 = Minggu (unik)',
  })
  @IsOptional()
  @IsString({ message: 'Hari kerja harus berupa teks, mis. "1,2,3,4,5"' })
  workDays?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean({ message: 'isActive harus boolean' })
  isActive?: boolean;
}

export class UpdateShiftDto extends PartialType(CreateShiftDto) {}

export const SHIFT_SORT_FIELDS = ['name', 'startTime', 'createdAt'] as const;

export class ShiftQueryDto extends PaginationQueryDto {}
