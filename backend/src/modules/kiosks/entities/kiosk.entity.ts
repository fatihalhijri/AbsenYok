import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class KioskLocationEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Kantor Pusat' })
  name: string;
}

/** Kiosk tanpa `secret` (secret tidak pernah dikirim ke client). */
export class KioskEntity {
  @ApiProperty({ format: 'uuid', example: '0d5c9a1e-2b3f-4c4d-8e5f-6a7b8c9d0e1f' })
  id: string;

  @ApiProperty({ example: 'Lobi Utama' })
  name: string;

  @ApiProperty({ example: 30 })
  qrIntervalSeconds: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: '2026-10-12T00:59:30.000Z', nullable: true, type: Date })
  lastSeenAt: Date | null;

  @ApiProperty({ type: KioskLocationEntity })
  location: KioskLocationEntity;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-11T01:05:22.000Z' })
  updatedAt: Date;
}

class KioskQrInfoEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lobi Utama' })
  name: string;

  @ApiProperty({ example: 'Kantor Pusat' })
  locationName: string;
}

export class KioskQrEntity {
  @ApiProperty({
    example: 'AY1.K.0d5c9a1e-2b3f-4c4d-8e5f-6a7b8c9d0e1f.59372161.Zx3kQ9vB2mN8pL1sT4wY6a',
  })
  token: string;

  @ApiProperty({
    example: '2026-10-12T01:00:30.000Z',
    description: 'Akhir window — tampilkan QR baru',
  })
  expiresAt: Date;

  @ApiProperty({ example: 30 })
  intervalSeconds: number;

  @ApiProperty({
    example: '2026-10-12T01:00:12.345Z',
    description: 'Jam server untuk sinkronisasi hitung mundur di layar kiosk',
  })
  serverTime: Date;

  @ApiProperty({ type: KioskQrInfoEntity })
  kiosk: KioskQrInfoEntity;
}

export class RecentScanEntity {
  @ApiProperty({ format: 'uuid', description: 'ID log scan' })
  id: string;

  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: 'EMP001' })
  employeeCode: string;

  @ApiPropertyOptional({ example: '/uploads/avatars/….webp', nullable: true, type: String })
  avatarUrl: string | null;

  @ApiProperty({ enum: ['CHECK_IN', 'CHECK_OUT'], example: 'CHECK_IN' })
  type: 'CHECK_IN' | 'CHECK_OUT';

  @ApiProperty({ example: '2026-10-12T00:58:03.000Z' })
  time: Date;

  @ApiProperty({ enum: ['PRESENT', 'LATE'], example: 'PRESENT', nullable: true })
  status: string | null;
}

export class PersonalQrEntity {
  @ApiProperty({
    example: 'AY1.P.5f6c178c-d6d4-47f0-bb34-9a3417a1b4df.29686080.aB3dE5fG7hJ9kL1mN3pQ5r',
  })
  token: string;

  @ApiProperty({ example: '2026-10-12T01:01:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: 60 })
  intervalSeconds: number;
}
