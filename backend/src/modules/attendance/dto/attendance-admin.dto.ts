import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { AttendanceStatus } from '@/generated/prisma/client';
import { IsOptionalNonNull } from '@/common/validators/is-optional-non-null.validator';

const STATUSES = Object.values(AttendanceStatus);
const STATUS_MESSAGE = `status harus salah satu dari: ${STATUSES.join(', ')}`;

/** ISO 8601 WAJIB dengan zona waktu agar tidak ambigu (mis. 2026-10-19T08:20:00+07:00). */
const DATETIME_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATETIME_MESSAGE = 'harus ISO 8601 dengan zona waktu, mis. 2026-10-19T08:20:00+07:00';

const notNull = (_: object, value: unknown) => value !== null;
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class MonthQueryDto {
  @ApiPropertyOptional({ example: '2026-10', description: 'Default: bulan berjalan' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month harus berformat YYYY-MM' })
  month?: string;
}

export const ATTENDANCE_SORT_FIELDS = [
  'date',
  'checkInAt',
  'lateMinutes',
  'workMinutes',
  'createdAt',
] as const;

export class AttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Default: awal bulan dateTo' })
  @IsOptional()
  @IsCalendarDate()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Default: hari ini. Rentang maks 92 hari',
  })
  @IsOptional()
  @IsCalendarDate()
  dateTo?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'userId harus UUID' })
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'departmentId harus UUID' })
  departmentId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(AttendanceStatus, { message: STATUS_MESSAGE })
  status?: AttendanceStatus;
}

export class ScanLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsCalendarDate()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Rentang maks 92 hari' })
  @IsOptional()
  @IsCalendarDate()
  dateTo?: string;

  @ApiPropertyOptional({ type: Boolean, example: false, description: 'false = hanya scan gagal' })
  @IsOptional()
  @Transform(toBoolean)
  @IsIn([true, false], { message: 'success harus true atau false' })
  success?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'userId harus UUID' })
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'kioskId harus UUID' })
  kioskId?: string;

  @ApiPropertyOptional({ example: 'OUTSIDE_GEOFENCE' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  errorCode?: string;
}

export class ManualAttendanceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'userId harus UUID' })
  userId: string;

  @ApiProperty({ example: '2026-10-19', description: 'Tanggal lokal; tidak boleh di masa depan' })
  @IsCalendarDate()
  date: string;

  @ApiPropertyOptional({
    example: '2026-10-19T08:20:00+07:00',
    description: 'Wajib untuk PRESENT/LATE',
  })
  @IsOptional()
  @Matches(DATETIME_WITH_ZONE, { message: `checkInAt ${DATETIME_MESSAGE}` })
  @IsISO8601({ strict: true }, { message: `checkInAt ${DATETIME_MESSAGE}` })
  checkInAt?: string;

  @ApiPropertyOptional({ example: '2026-10-19T17:00:00+07:00' })
  @IsOptional()
  @Matches(DATETIME_WITH_ZONE, { message: `checkOutAt ${DATETIME_MESSAGE}` })
  @IsISO8601({ strict: true }, { message: `checkOutAt ${DATETIME_MESSAGE}` })
  checkOutAt?: string;

  @ApiProperty({ enum: STATUSES, example: AttendanceStatus.LATE })
  @IsEnum(AttendanceStatus, { message: STATUS_MESSAGE })
  status: AttendanceStatus;

  @ApiProperty({ example: 'Lupa absen karena HP tertinggal, dikonfirmasi atasan' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Alasan wajib diisi' })
  @MinLength(10, { message: 'Alasan minimal 10 karakter' })
  @MaxLength(255, { message: 'Alasan maksimal 255 karakter' })
  reason: string;
}

export class CorrectAttendanceDto {
  @ApiPropertyOptional({
    example: '2026-10-19T07:55:00+07:00',
    nullable: true,
    description: 'null = hapus jam masuk',
  })
  @IsOptional()
  @ValidateIf(notNull)
  @Matches(DATETIME_WITH_ZONE, { message: `checkInAt ${DATETIME_MESSAGE}` })
  @IsISO8601({ strict: true }, { message: `checkInAt ${DATETIME_MESSAGE}` })
  checkInAt?: string | null;

  @ApiPropertyOptional({ example: '2026-10-19T17:00:00+07:00', nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @Matches(DATETIME_WITH_ZONE, { message: `checkOutAt ${DATETIME_MESSAGE}` })
  @IsISO8601({ strict: true }, { message: `checkOutAt ${DATETIME_MESSAGE}` })
  checkOutAt?: string | null;

  @ApiPropertyOptional({
    enum: STATUSES,
    description: 'Bila tidak dikirim & jam masuk berubah, PRESENT/LATE dihitung ulang',
  })
  @IsOptionalNonNull()
  @IsEnum(AttendanceStatus, { message: STATUS_MESSAGE })
  status?: AttendanceStatus;

  @ApiPropertyOptional({ example: 'Terlambat karena banjir', nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsString({ message: 'Catatan harus berupa teks' })
  @MaxLength(255, { message: 'Catatan maksimal 255 karakter' })
  note?: string | null;

  @ApiProperty({ example: 'Koreksi jam masuk sesuai rekaman CCTV lobi' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Alasan koreksi wajib diisi' })
  @MinLength(10, { message: 'Alasan koreksi minimal 10 karakter' })
  @MaxLength(255, { message: 'Alasan koreksi maksimal 255 karakter' })
  reason: string;
}

export class RecalculateQueryDto {
  @ApiProperty({ example: '2026-10-19', description: 'Tidak boleh di masa depan' })
  @IsCalendarDate()
  date: string;
}
