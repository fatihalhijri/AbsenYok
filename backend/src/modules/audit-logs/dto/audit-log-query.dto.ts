import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { AuditAction } from '../audit-action';

const ACTIONS = Object.values(AuditAction);

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ACTIONS })
  @IsOptional()
  @IsIn(ACTIONS, { message: `action harus salah satu dari: ${ACTIONS.join(', ')}` })
  action?: AuditAction;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'actorId harus UUID' })
  actorId?: string;

  @ApiPropertyOptional({ example: 'Attendance' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entity?: string;

  @ApiPropertyOptional({ example: '5f6c178c-d6d4-47f0-bb34-9a3417a1b4df' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  entityId?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Default: awal bulan dateTo' })
  @IsOptional()
  @IsCalendarDate()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Default: hari ini; rentang maks 92 hari',
  })
  @IsOptional()
  @IsCalendarDate()
  dateTo?: string;
}

class AuditActorEntity {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Admin HR' }) name: string;
  @ApiProperty({ example: 'admin@absenyok.id' }) email: string;
  @ApiProperty({ example: 'ADMIN' }) role: string;
}

export class AuditLogEntity {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ACTIONS, example: 'ATTENDANCE_CORRECTED' }) action: string;
  @ApiProperty({ example: 'Attendance' }) entity: string;
  @ApiPropertyOptional({ nullable: true, type: String }) entityId: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: { before: { status: 'LATE' }, after: { status: 'PRESENT' }, reason: 'Sesuai CCTV' },
  })
  metadata: unknown;
  @ApiPropertyOptional({ example: '10.0.0.7', nullable: true, type: String }) ipAddress:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) userAgent: string | null;
  @ApiProperty({ example: '2026-10-19T03:00:00.000Z' }) createdAt: Date;
  @ApiPropertyOptional({ type: AuditActorEntity, nullable: true }) actor: AuditActorEntity | null;
}
