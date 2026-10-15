import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import {
  IsOptionalNonNull,
  PARTIAL_REJECT_NULL,
} from '@/common/validators/is-optional-non-null.validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateLocationDto {
  @ApiProperty({ example: 'Kantor Pusat' })
  @Transform(trim)
  @IsString({ message: 'Nama lokasi wajib diisi' })
  @MinLength(2, { message: 'Nama lokasi minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama lokasi maksimal 100 karakter' })
  name: string;

  @ApiPropertyOptional({
    example: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
    nullable: true,
  })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'Alamat harus berupa teks' })
  @MaxLength(255, { message: 'Alamat maksimal 255 karakter' })
  address?: string | null;

  @ApiProperty({ example: -6.2, minimum: -90, maximum: 90 })
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'Latitude harus angka (maks 7 desimal)' })
  @Min(-90, { message: 'Latitude minimal -90' })
  @Max(90, { message: 'Latitude maksimal 90' })
  latitude: number;

  @ApiProperty({ example: 106.8166667, minimum: -180, maximum: 180 })
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'Longitude harus angka (maks 7 desimal)' })
  @Min(-180, { message: 'Longitude minimal -180' })
  @Max(180, { message: 'Longitude maksimal 180' })
  longitude: number;

  @ApiPropertyOptional({ example: 100, minimum: 10, maximum: 5000, default: 100 })
  @IsOptionalNonNull()
  @IsInt({ message: 'Radius harus bilangan bulat (meter)' })
  @Min(10, { message: 'Radius minimal 10 meter' })
  @Max(5000, { message: 'Radius maksimal 5000 meter' })
  radiusMeters?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptionalNonNull()
  @IsBoolean({ message: 'isActive harus boolean' })
  isActive?: boolean;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto, PARTIAL_REJECT_NULL) {}

export const LOCATION_SORT_FIELDS = ['name', 'createdAt'] as const;

export class LocationQueryDto extends PaginationQueryDto {}
