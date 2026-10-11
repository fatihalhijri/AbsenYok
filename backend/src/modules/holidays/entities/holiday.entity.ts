import { ApiProperty } from '@nestjs/swagger';

export class HolidayEntity {
  @ApiProperty({ format: 'uuid', example: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e' })
  id: string;

  @ApiProperty({ example: '2026-12-25' })
  date: string;

  @ApiProperty({ example: 'Hari Raya Natal' })
  name: string;
}

export class BulkHolidayResultEntity {
  @ApiProperty({ example: 2 })
  created: number;

  @ApiProperty({ example: 1, description: 'Tanggal yang sudah ada sebelumnya (dilewati)' })
  skipped: number;
}
