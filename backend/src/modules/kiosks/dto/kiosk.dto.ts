import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import {
  IsOptionalNonNull,
  PARTIAL_REJECT_NULL,
} from '@/common/validators/is-optional-non-null.validator';

export const MIN_QR_INTERVAL_SECONDS = 10;
export const MAX_QR_INTERVAL_SECONDS = 300;

export class CreateKioskDto {
  @ApiProperty({ example: 'Lobi Utama' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nama kiosk wajib diisi' })
  @MinLength(2, { message: 'Nama kiosk minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama kiosk maksimal 100 karakter' })
  name: string;

  @ApiProperty({ format: 'uuid', description: 'Lokasi kantor (harus ada & aktif)' })
  @IsUUID('all', { message: 'locationId harus UUID' })
  locationId: string;

  @ApiPropertyOptional({
    example: 30,
    minimum: MIN_QR_INTERVAL_SECONDS,
    maximum: MAX_QR_INTERVAL_SECONDS,
    description: 'Default: env QR_KIOSK_INTERVAL_SECONDS',
  })
  @IsOptionalNonNull()
  @IsInt({ message: 'Interval QR harus bilangan bulat (detik)' })
  @Min(MIN_QR_INTERVAL_SECONDS, { message: `Interval QR minimal ${MIN_QR_INTERVAL_SECONDS} detik` })
  @Max(MAX_QR_INTERVAL_SECONDS, {
    message: `Interval QR maksimal ${MAX_QR_INTERVAL_SECONDS} detik`,
  })
  qrIntervalSeconds?: number;
}

export class UpdateKioskDto extends PartialType(CreateKioskDto, PARTIAL_REJECT_NULL) {
  @ApiPropertyOptional({ example: true })
  @IsOptionalNonNull()
  @IsBoolean({ message: 'isActive harus boolean' })
  isActive?: boolean;
}

export const KIOSK_SORT_FIELDS = ['name', 'createdAt', 'lastSeenAt'] as const;

export class KioskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'locationId harus UUID' })
  locationId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptionalNonNull()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsIn([true, false], { message: 'isActive harus true atau false' })
  isActive?: boolean;
}
