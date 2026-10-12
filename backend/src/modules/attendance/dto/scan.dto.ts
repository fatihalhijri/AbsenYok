import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const MAX_QR_TOKEN_LENGTH = 200;

class ScanCoordinatesDto {
  @ApiProperty({ example: -6.2000123, minimum: -90, maximum: 90 })
  @IsNumber({}, { message: 'latitude harus angka' })
  @Min(-90, { message: 'latitude minimal -90' })
  @Max(90, { message: 'latitude maksimal 90' })
  latitude: number;

  @ApiProperty({ example: 106.8166541, minimum: -180, maximum: 180 })
  @IsNumber({}, { message: 'longitude harus angka' })
  @Min(-180, { message: 'longitude minimal -180' })
  @Max(180, { message: 'longitude maksimal 180' })
  longitude: number;

  @ApiProperty({
    example: 12.5,
    minimum: 0,
    description: 'Akurasi GPS (meter) dari Geolocation API',
  })
  @IsNumber({}, { message: 'accuracy harus angka' })
  @Min(0, { message: 'accuracy minimal 0' })
  @Max(100_000, { message: 'accuracy terlalu besar' })
  accuracy: number;
}

export class ScanKioskDto extends ScanCoordinatesDto {
  @ApiProperty({
    example: 'AY1.K.0d5c9a1e-2b3f-4c4d-8e5f-6a7b8c9d0e1f.59372161.Zx3kQ9vB2mN8pL1sT4wY6a',
  })
  @IsString({ message: 'qrToken wajib diisi' })
  @MaxLength(MAX_QR_TOKEN_LENGTH, { message: `qrToken maksimal ${MAX_QR_TOKEN_LENGTH} karakter` })
  qrToken: string;

  @ApiProperty({
    format: 'uuid',
    description: 'ID perangkat (crypto.randomUUID, disimpan di localStorage `ay_device_id`)',
  })
  @IsUUID('all', { message: 'deviceId harus UUID' })
  deviceId: string;
}

export class PersonalScanDto extends ScanCoordinatesDto {
  @ApiProperty({
    example: 'AY1.P.5f6c178c-d6d4-47f0-bb34-9a3417a1b4df.29686080.aB3dE5fG7hJ9kL1mN3pQ5r',
  })
  @IsString({ message: 'qrToken wajib diisi' })
  @MaxLength(MAX_QR_TOKEN_LENGTH, { message: `qrToken maksimal ${MAX_QR_TOKEN_LENGTH} karakter` })
  qrToken: string;

  @ApiProperty({ format: 'uuid', description: 'Lokasi tempat petugas memindai' })
  @IsUUID('all', { message: 'locationId harus UUID' })
  locationId: string;
}
