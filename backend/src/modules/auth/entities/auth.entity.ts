import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/common/constants/roles';

class IdNameEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Teknologi Informasi' })
  name: string;
}

class ProfileShiftEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Reguler' })
  name: string;

  @ApiProperty({ example: '08:00' })
  startTime: string;

  @ApiProperty({ example: '17:00' })
  endTime: string;

  @ApiProperty({ example: 15 })
  lateToleranceMinutes: number;

  @ApiProperty({ example: 60 })
  checkInOpenMinutes: number;

  @ApiProperty({ example: '1,2,3,4,5', description: 'ISO weekday: 1 = Senin … 7 = Minggu' })
  workDays: string;
}

/** Dokumentasi Swagger untuk `UserProfile`. */
export class UserProfileEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EMP001' })
  employeeCode: string;

  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: 'budi.santoso@absenyok.id' })
  email: string;

  @ApiPropertyOptional({ example: '081234567890', nullable: true, type: String })
  phone: string | null;

  @ApiPropertyOptional({ example: 'Software Engineer', nullable: true, type: String })
  position: string | null;

  @ApiProperty({ enum: Object.values(Role), example: Role.EMPLOYEE })
  role: Role;

  @ApiPropertyOptional({ nullable: true, type: String })
  avatarUrl: string | null;

  @ApiPropertyOptional({ type: IdNameEntity, nullable: true })
  department: IdNameEntity | null;

  @ApiPropertyOptional({ type: ProfileShiftEntity, nullable: true })
  shift: ProfileShiftEntity | null;

  @ApiPropertyOptional({ type: IdNameEntity, nullable: true })
  location: IdNameEntity | null;

  @ApiProperty({ example: true })
  hasBoundDevice: boolean;
}

export class AuthTokenEntity {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 900, description: 'Masa berlaku access token (detik)' })
  expiresIn: number;

  @ApiProperty({ type: UserProfileEntity })
  user: UserProfileEntity;
}
