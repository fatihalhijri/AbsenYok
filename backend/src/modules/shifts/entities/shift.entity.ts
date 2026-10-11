import { ApiProperty } from '@nestjs/swagger';

export class ShiftEntity {
  @ApiProperty({ format: 'uuid', example: '7a2b9c1d-3e4f-4a5b-8c6d-7e8f9a0b1c2d' })
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

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 8, description: 'Jumlah karyawan yang memakai shift ini' })
  userCount: number;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  updatedAt: Date;
}
