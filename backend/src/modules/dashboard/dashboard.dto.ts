import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class TrendQueryDto {
  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 92, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days harus bilangan bulat' })
  @Min(1, { message: 'days minimal 1' })
  @Max(92, { message: 'days maksimal 92' })
  days: number = 30;
}

export class RankingQueryDto {
  @ApiPropertyOptional({ example: '2026-10', description: 'Default: bulan berjalan' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month harus berformat YYYY-MM' })
  month?: string;
}

export class DashboardHolidayEntity {
  @ApiProperty({ example: 'Hari Raya Natal' })
  name: string;
}

export class DashboardSummaryEntity {
  @ApiProperty({ example: '2026-10-19' }) date: string;
  @ApiProperty({ example: 120, description: 'Karyawan yang dijadwalkan bekerja hari ini' })
  totalEmployees: number;
  @ApiProperty({ example: 95 }) present: number;
  @ApiProperty({ example: 8 }) late: number;
  @ApiProperty({ example: 0, description: 'Terisi setelah cron 23:55' }) absent: number;
  @ApiProperty({ example: 4 }) onLeave: number;
  @ApiProperty({ example: 13 }) notYetCheckedIn: number;
  @ApiProperty({ example: 85.8 }) attendanceRate: number;
  @ApiPropertyOptional({
    type: () => DashboardHolidayEntity,
    nullable: true,
    description: 'Terisi bila hari ini libur',
  })
  holiday: DashboardHolidayEntity | null;
}

export class TrendPointEntity {
  @ApiProperty({ example: '2026-10-19' }) date: string;
  @ApiProperty({ example: 95 }) present: number;
  @ApiProperty({ example: 8 }) late: number;
  @ApiProperty({ example: 3 }) absent: number;
  @ApiProperty({ example: 4, description: 'SICK + PERMIT + LEAVE' }) leave: number;
}

class RankingUserEntity {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Budi Santoso' }) name: string;
  @ApiProperty({ example: 'EMP001' }) employeeCode: string;
  @ApiPropertyOptional({ nullable: true, type: String }) avatarUrl: string | null;
  @ApiPropertyOptional({ example: 'Teknologi Informasi', nullable: true, type: String })
  department: string | null;
}

export class LateRankingEntity {
  @ApiProperty({ example: 1 }) rank: number;
  @ApiProperty({ type: RankingUserEntity }) user: RankingUserEntity;
  @ApiProperty({ example: 6 }) lateCount: number;
  @ApiProperty({ example: 187 }) totalLateMinutes: number;
}

class ActivityUserEntity {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Budi Santoso' }) name: string;
  @ApiProperty({ example: 'EMP001' }) employeeCode: string;
  @ApiPropertyOptional({ nullable: true, type: String }) avatarUrl: string | null;
}

class ActivityKioskEntity {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Lobi Utama' }) name: string;
}

export class RecentActivityEntity {
  @ApiProperty({ format: 'uuid' }) attendanceId: string;
  @ApiProperty({ enum: ['CHECK_IN', 'CHECK_OUT'], example: 'CHECK_IN' }) type: string;
  @ApiProperty({ example: '2026-10-19T00:52:10.000Z' }) time: Date;
  @ApiProperty({ example: 'PRESENT' }) status: string;
  @ApiPropertyOptional({ example: 'KIOSK_QR', nullable: true, type: String }) method: string | null;
  @ApiPropertyOptional({ type: ActivityKioskEntity, nullable: true })
  kiosk: ActivityKioskEntity | null;
  @ApiProperty({ type: ActivityUserEntity }) user: ActivityUserEntity;
}
