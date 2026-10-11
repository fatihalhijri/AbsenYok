import { ApiPropertyOptional } from '@nestjs/swagger';
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

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * `PATCH /settings` — hanya key di whitelist yang diterima (key lain ditolak oleh
 * `forbidNonWhitelisted`). Semua field opsional; kirim yang ingin diubah saja.
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'PT AbsenYok Indonesia' })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'company.name harus berupa teks' })
  @MinLength(2, { message: 'company.name minimal 2 karakter' })
  @MaxLength(100, { message: 'company.name maksimal 100 karakter' })
  'company.name'?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/logo.png',
    description: 'URL http(s), path /..., atau kosong',
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'company.logoUrl harus berupa teks' })
  @MaxLength(255, { message: 'company.logoUrl maksimal 255 karakter' })
  @Matches(/^$|^https?:\/\/\S+$|^\/\S*$/, {
    message: 'company.logoUrl harus URL http(s), path diawali "/", atau kosong',
  })
  'company.logoUrl'?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'attendance.geofenceEnabled harus boolean' })
  'attendance.geofenceEnabled'?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'attendance.deviceBindingEnabled harus boolean' })
  'attendance.deviceBindingEnabled'?: boolean;

  @ApiPropertyOptional({ example: 5, minimum: 0, maximum: 240 })
  @IsOptional()
  @IsInt({ message: 'attendance.minCheckoutGapMinutes harus bilangan bulat' })
  @Min(0, { message: 'attendance.minCheckoutGapMinutes minimal 0' })
  @Max(240, { message: 'attendance.minCheckoutGapMinutes maksimal 240' })
  'attendance.minCheckoutGapMinutes'?: number;

  @ApiPropertyOptional({ example: 12, minimum: 0, maximum: 365 })
  @IsOptional()
  @IsInt({ message: 'leave.annualQuota harus bilangan bulat' })
  @Min(0, { message: 'leave.annualQuota minimal 0' })
  @Max(365, { message: 'leave.annualQuota maksimal 365' })
  'leave.annualQuota'?: number;

  @ApiPropertyOptional({ example: 14, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt({ message: 'leave.maxRangeDays harus bilangan bulat' })
  @Min(1, { message: 'leave.maxRangeDays minimal 1' })
  @Max(90, { message: 'leave.maxRangeDays maksimal 90' })
  'leave.maxRangeDays'?: number;
}
