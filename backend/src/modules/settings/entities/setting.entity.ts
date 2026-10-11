import { ApiProperty } from '@nestjs/swagger';

export class SettingsEntity {
  @ApiProperty({ example: 'PT AbsenYok Indonesia' })
  'company.name': string;

  @ApiProperty({ example: '' })
  'company.logoUrl': string;

  @ApiProperty({ example: true })
  'attendance.geofenceEnabled': boolean;

  @ApiProperty({ example: true })
  'attendance.deviceBindingEnabled': boolean;

  @ApiProperty({ example: 5 })
  'attendance.minCheckoutGapMinutes': number;

  @ApiProperty({ example: 12 })
  'leave.annualQuota': number;

  @ApiProperty({ example: 14 })
  'leave.maxRangeDays': number;
}

export class PublicSettingsEntity {
  @ApiProperty({ example: 'PT AbsenYok Indonesia' })
  companyName: string;

  @ApiProperty({ example: '' })
  logoUrl: string;
}
