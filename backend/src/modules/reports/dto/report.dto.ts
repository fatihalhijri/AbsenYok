import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_MESSAGE = 'month harus berformat YYYY-MM';

export class MonthlyReportQueryDto {
  @ApiProperty({ example: '2026-10' })
  @Matches(MONTH_PATTERN, { message: MONTH_MESSAGE })
  month: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'departmentId harus UUID' })
  departmentId?: string;
}

export class MonthlyExportQueryDto extends MonthlyReportQueryDto {
  @ApiProperty({ enum: ['xlsx', 'pdf'], example: 'xlsx' })
  @IsIn(['xlsx', 'pdf'], { message: 'format harus xlsx atau pdf' })
  format: 'xlsx' | 'pdf';
}

export class DailyExportQueryDto {
  @ApiProperty({ example: '2026-10-19', description: 'Tidak boleh di masa depan' })
  @IsCalendarDate()
  date: string;

  @ApiProperty({ enum: ['xlsx', 'pdf'], example: 'pdf' })
  @IsIn(['xlsx', 'pdf'], { message: 'format harus xlsx atau pdf' })
  format: 'xlsx' | 'pdf';
}

export class MyExportQueryDto {
  @ApiProperty({ example: '2026-10' })
  @Matches(MONTH_PATTERN, { message: MONTH_MESSAGE })
  month: string;

  @ApiPropertyOptional({ enum: ['pdf'], default: 'pdf' })
  @IsOptional()
  @IsIn(['pdf'], { message: 'format laporan pribadi hanya pdf' })
  format?: 'pdf';
}
