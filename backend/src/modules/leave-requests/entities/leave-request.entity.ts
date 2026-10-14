import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LeaveUserDepartmentEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Teknologi Informasi' })
  name: string;
}

class LeaveUserEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: 'EMP001' })
  employeeCode: string;

  @ApiPropertyOptional({ type: LeaveUserDepartmentEntity, nullable: true })
  department: LeaveUserDepartmentEntity | null;
}

class LeaveReviewerEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Admin HR' })
  name: string;
}

export class LeaveRequestEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: ['SICK', 'PERMIT', 'ANNUAL'], example: 'SICK' })
  type: string;

  @ApiProperty({ example: '2026-10-22' })
  startDate: string;

  @ApiProperty({ example: '2026-10-23' })
  endDate: string;

  @ApiProperty({ example: 2, description: 'Jumlah hari kerja (tanpa akhir pekan & hari libur)' })
  totalDays: number;

  @ApiProperty({ example: 'Demam tinggi, disarankan istirahat oleh dokter' })
  reason: string;

  @ApiProperty({ example: true })
  hasAttachment: boolean;

  @ApiPropertyOptional({
    example: '/api/v1/leave-requests/6b1f…/attachment',
    nullable: true,
    type: String,
    description: 'Endpoint terproteksi (pemilik/admin)',
  })
  attachmentUrl: string | null;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], example: 'PENDING' })
  status: string;

  @ApiPropertyOptional({ nullable: true, type: Date, example: null })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: null })
  reviewNote: string | null;

  @ApiProperty({ type: LeaveUserEntity })
  user: LeaveUserEntity;

  @ApiPropertyOptional({ type: LeaveReviewerEntity, nullable: true })
  reviewedBy: LeaveReviewerEntity | null;

  @ApiProperty({ example: '2026-10-21T03:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-21T03:00:00.000Z' })
  updatedAt: Date;
}

export class LeaveQuotaEntity {
  @ApiProperty({ example: 2026 }) year: number;
  @ApiProperty({ example: 12 }) quota: number;
  @ApiProperty({ example: 3, description: 'Hari cuti tahunan APPROVED' }) used: number;
  @ApiProperty({ example: 2, description: 'Hari cuti tahunan menunggu persetujuan' })
  pending: number;
  @ApiProperty({ example: 9, description: 'quota − used' }) remaining: number;
}
