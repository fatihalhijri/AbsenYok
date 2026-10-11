import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocationEntity {
  @ApiProperty({ format: 'uuid', example: '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' })
  id: string;

  @ApiProperty({ example: 'Kantor Pusat' })
  name: string;

  @ApiPropertyOptional({
    example: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
    nullable: true,
    type: String,
  })
  address: string | null;

  @ApiProperty({ example: -6.2 })
  latitude: number;

  @ApiProperty({ example: 106.8166667 })
  longitude: number;

  @ApiProperty({ example: 100, description: 'Radius geofence (meter)' })
  radiusMeters: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  kioskCount: number;

  @ApiProperty({ example: 10, description: 'Karyawan dengan lokasi kerja default ini' })
  userCount: number;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  updatedAt: Date;
}
