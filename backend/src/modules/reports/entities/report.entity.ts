import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonthlyReportRowEntity {
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty({ example: 'EMP001' }) employeeCode: string;
  @ApiProperty({ example: 'Budi Santoso' }) name: string;
  @ApiPropertyOptional({ example: 'Teknologi Informasi', nullable: true, type: String })
  department: string | null;
  @ApiProperty({ example: 22, description: 'Hari kerja yang sudah lewat' }) workingDays: number;
  @ApiProperty({ example: 18 }) present: number;
  @ApiProperty({ example: 2 }) late: number;
  @ApiProperty({ example: 41 }) totalLateMinutes: number;
  @ApiProperty({ example: 1 }) absent: number;
  @ApiProperty({ example: 1 }) sick: number;
  @ApiProperty({ example: 0 }) permit: number;
  @ApiProperty({ example: 0 }) leave: number;
  @ApiProperty({ example: 10560 }) totalWorkMinutes: number;
  @ApiProperty({ example: 90.9, description: 'Persentase kehadiran (1 desimal)' })
  attendanceRate: number;
}

export class MonthlyReportEntity {
  @ApiProperty({ example: '2026-10' }) month: string;
  @ApiProperty({ example: 'PT AbsenYok Indonesia' }) companyName: string;
  @ApiPropertyOptional({ example: null, nullable: true, type: String }) departmentName:
    string | null;
  @ApiProperty({ type: [MonthlyReportRowEntity] }) items: MonthlyReportRowEntity[];
}
