import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-10-12', description: 'Tanggal lokal (APP_TIMEZONE)' })
  date: string;

  @ApiProperty({ enum: ['PRESENT', 'LATE', 'ABSENT', 'SICK', 'PERMIT', 'LEAVE'], example: 'LATE' })
  status: string;

  @ApiPropertyOptional({ example: '2026-10-12T01:22:10.000Z', nullable: true, type: Date })
  checkInAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true, type: Date })
  checkOutAt: Date | null;

  @ApiPropertyOptional({
    enum: ['KIOSK_QR', 'PERSONAL_QR', 'MANUAL'],
    nullable: true,
    example: 'KIOSK_QR',
  })
  checkInMethod: string | null;

  @ApiPropertyOptional({
    enum: ['KIOSK_QR', 'PERSONAL_QR', 'MANUAL'],
    nullable: true,
    example: null,
  })
  checkOutMethod: string | null;

  @ApiProperty({ example: 7 })
  lateMinutes: number;

  @ApiProperty({ example: 0 })
  earlyLeaveMinutes: number;

  @ApiProperty({ example: 0 })
  workMinutes: number;

  @ApiPropertyOptional({ nullable: true, type: String, example: null })
  note: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  kioskId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  locationId: string | null;
}

class ScanUserEntity {
  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: 'EMP001' })
  employeeCode: string;
}

export class ScanResultEntity {
  @ApiProperty({ enum: ['CHECK_IN', 'CHECK_OUT'], example: 'CHECK_IN' })
  type: string;

  @ApiProperty({ type: AttendanceEntity })
  attendance: AttendanceEntity;

  @ApiProperty({ example: 'Absen masuk berhasil pukul 08:22. Anda terlambat 7 menit.' })
  message: string;

  @ApiProperty({ type: ScanUserEntity })
  user: ScanUserEntity;
}

class TodayShiftEntity {
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

  @ApiProperty({ example: '1,2,3,4,5' })
  workDays: string;
}

class TodayHolidayEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-12-25' })
  date: string;

  @ApiProperty({ example: 'Hari Raya Natal' })
  name: string;
}

class TodayLeaveEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['SICK', 'PERMIT', 'ANNUAL'], example: 'SICK' })
  type: string;

  @ApiProperty({ example: '2026-10-12' })
  startDate: string;

  @ApiProperty({ example: '2026-10-13' })
  endDate: string;
}

export class MyTodayEntity {
  @ApiProperty({ example: '2026-10-12' })
  date: string;

  @ApiProperty({ example: '2026-10-12T00:45:10.000Z' })
  serverTime: Date;

  @ApiPropertyOptional({ type: AttendanceEntity, nullable: true })
  attendance: AttendanceEntity | null;

  @ApiPropertyOptional({ type: TodayShiftEntity, nullable: true })
  shift: TodayShiftEntity | null;

  @ApiProperty({ example: true })
  isWorkingDay: boolean;

  @ApiPropertyOptional({ type: TodayHolidayEntity, nullable: true })
  holiday: TodayHolidayEntity | null;

  @ApiPropertyOptional({ type: TodayLeaveEntity, nullable: true })
  leave: TodayLeaveEntity | null;

  @ApiProperty({ example: true })
  canCheckIn: boolean;

  @ApiProperty({ example: false })
  canCheckOut: boolean;

  @ApiPropertyOptional({ example: '2026-10-12T00:00:00.000Z', nullable: true, type: Date })
  checkInOpensAt: Date | null;

  @ApiPropertyOptional({ example: '2026-10-12T10:00:00.000Z', nullable: true, type: Date })
  checkInClosesAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true, type: Date })
  checkOutAvailableAt: Date | null;
}
