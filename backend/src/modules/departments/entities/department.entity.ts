import { ApiProperty } from '@nestjs/swagger';

export class DepartmentEntity {
  @ApiProperty({ format: 'uuid', example: '3f1c2a9e-8b7d-4c1e-9a2b-1f2e3d4c5b6a' })
  id: string;

  @ApiProperty({ example: 'IT' })
  code: string;

  @ApiProperty({ example: 'Teknologi Informasi' })
  name: string;

  @ApiProperty({ example: 12, description: 'Jumlah karyawan (tidak termasuk yang dihapus)' })
  userCount: number;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  updatedAt: Date;
}
