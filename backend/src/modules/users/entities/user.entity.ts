import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/common/constants/roles';

class UserDepartmentEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'IT' })
  code: string;

  @ApiProperty({ example: 'Teknologi Informasi' })
  name: string;
}

class UserShiftEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Reguler' })
  name: string;

  @ApiProperty({ example: '08:00' })
  startTime: string;

  @ApiProperty({ example: '17:00' })
  endTime: string;
}

class UserLocationEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Kantor Pusat' })
  name: string;
}

/** Bentuk user untuk endpoint admin (tanpa passwordHash/lockout/device id mentah). */
export class UserEntity {
  @ApiProperty({ format: 'uuid', example: '5f6c178c-d6d4-47f0-bb34-9a3417a1b4df' })
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

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: '/uploads/avatars/0b8f….webp', nullable: true, type: String })
  avatarUrl: string | null;

  @ApiProperty({ example: true, description: 'Sudah terikat ke satu perangkat (device binding)' })
  hasBoundDevice: boolean;

  @ApiPropertyOptional({ example: '2026-10-11T01:05:22.000Z', nullable: true, type: Date })
  lastLoginAt: Date | null;

  @ApiPropertyOptional({ type: UserDepartmentEntity, nullable: true })
  department: UserDepartmentEntity | null;

  @ApiPropertyOptional({ type: UserShiftEntity, nullable: true })
  shift: UserShiftEntity | null;

  @ApiPropertyOptional({ type: UserLocationEntity, nullable: true })
  location: UserLocationEntity | null;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  updatedAt: Date;
}

export class AvatarEntity {
  @ApiProperty({ example: '/uploads/avatars/0b8f9e1a-2c3d-4e5f-8a9b-0c1d2e3f4a5b.webp' })
  avatarUrl: string;
}

export class ImportResultEntity {
  @ApiProperty({ example: 25, description: 'Jumlah karyawan yang berhasil diimpor' })
  imported: number;
}
