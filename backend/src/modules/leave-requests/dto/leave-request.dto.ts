import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
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
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { LeaveStatus, LeaveType } from '@/generated/prisma/client';

const TYPES = Object.values(LeaveType);
const STATUSES = Object.values(LeaveStatus);
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Body multipart `POST /leave-requests` (file lampiran di field `attachment`). */
export class CreateLeaveRequestDto {
  @ApiProperty({
    enum: TYPES,
    example: LeaveType.SICK,
    description: 'SICK sakit · PERMIT izin · ANNUAL cuti',
  })
  @IsEnum(LeaveType, { message: `type harus salah satu dari: ${TYPES.join(', ')}` })
  type: LeaveType;

  @ApiProperty({ example: '2026-10-22', description: 'Paling lambat 7 hari ke belakang' })
  @IsCalendarDate()
  startDate: string;

  @ApiProperty({ example: '2026-10-23' })
  @IsCalendarDate()
  endDate: string;

  @ApiProperty({ example: 'Demam tinggi, disarankan istirahat oleh dokter' })
  @Transform(trim)
  @IsString({ message: 'Alasan wajib diisi' })
  @MinLength(5, { message: 'Alasan minimal 5 karakter' })
  @MaxLength(1000, { message: 'Alasan maksimal 1000 karakter' })
  reason: string;
}

export class ApproveLeaveDto {
  @ApiPropertyOptional({ example: 'Semoga lekas sembuh' })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Catatan harus berupa teks' })
  @MaxLength(255, { message: 'Catatan maksimal 255 karakter' })
  note?: string;
}

export class RejectLeaveDto {
  @ApiProperty({ example: 'Bertepatan dengan audit tahunan, mohon ajukan di minggu berikutnya' })
  @Transform(trim)
  @IsString({ message: 'Alasan penolakan wajib diisi' })
  @MinLength(5, { message: 'Alasan penolakan minimal 5 karakter' })
  @MaxLength(255, { message: 'Alasan penolakan maksimal 255 karakter' })
  note: string;
}

export class MyLeaveQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(LeaveStatus, { message: `status harus salah satu dari: ${STATUSES.join(', ')}` })
  status?: LeaveStatus;

  @ApiPropertyOptional({ example: 2026, description: 'Default: tahun berjalan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'year harus bilangan bulat' })
  @Min(2000, { message: 'year minimal 2000' })
  @Max(2100, { message: 'year maksimal 2100' })
  year?: number;
}

export class QuotaQueryDto {
  @ApiPropertyOptional({ example: 2026, description: 'Default: tahun berjalan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'year harus bilangan bulat' })
  @Min(2000, { message: 'year minimal 2000' })
  @Max(2100, { message: 'year maksimal 2100' })
  year?: number;
}

export const LEAVE_SORT_FIELDS = ['createdAt', 'startDate', 'totalDays'] as const;

export class LeaveQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(LeaveStatus, { message: `status harus salah satu dari: ${STATUSES.join(', ')}` })
  status?: LeaveStatus;

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsEnum(LeaveType, { message: `type harus salah satu dari: ${TYPES.join(', ')}` })
  type?: LeaveType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'userId harus UUID' })
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'departmentId harus UUID' })
  departmentId?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Pengajuan yang beririsan dengan rentang',
  })
  @IsOptional()
  @IsCalendarDate()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsCalendarDate()
  dateTo?: string;
}
