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

class AttendanceUserDepartmentEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Teknologi Informasi' })
  name: string;
}

class AttendanceUserEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: 'EMP001' })
  employeeCode: string;

  @ApiPropertyOptional({ type: AttendanceUserDepartmentEntity, nullable: true })
  department: AttendanceUserDepartmentEntity | null;
}

export class AttendanceListItemEntity extends AttendanceEntity {
  @ApiProperty({ type: AttendanceUserEntity })
  user: AttendanceUserEntity;
}

class IdNameEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lobi Utama' })
  name: string;
}

class ScanLogUserEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: 'EMP001' })
  employeeCode: string;
}

export class ScanLogEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-10-19T01:02:03.000Z' })
  createdAt: Date;

  @ApiProperty({ enum: ['KIOSK', 'PERSONAL'], example: 'KIOSK' })
  scanType: string;

  @ApiProperty({ example: false })
  success: boolean;

  @ApiPropertyOptional({ example: 'OUTSIDE_GEOFENCE', nullable: true, type: String })
  errorCode: string | null;

  @ApiPropertyOptional({ example: -6.2022, nullable: true, type: Number })
  latitude: number | null;

  @ApiPropertyOptional({ example: 106.8166667, nullable: true, type: Number })
  longitude: number | null;

  @ApiPropertyOptional({ example: 10, nullable: true, type: Number })
  accuracy: number | null;

  @ApiPropertyOptional({
    example: 245,
    nullable: true,
    type: Number,
    description: 'Meter dari lokasi',
  })
  distance: number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  deviceId: string | null;

  @ApiPropertyOptional({ example: '10.0.0.7', nullable: true, type: String })
  ipAddress: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  userAgent: string | null;

  @ApiPropertyOptional({ type: ScanLogUserEntity, nullable: true })
  user: ScanLogUserEntity | null;

  @ApiPropertyOptional({ type: IdNameEntity, nullable: true })
  kiosk: IdNameEntity | null;
}

class AttendanceLeaveRefEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['SICK', 'PERMIT', 'ANNUAL'], example: 'SICK' })
  type: string;

  @ApiProperty({ example: 'APPROVED' })
  status: string;
}

export class AttendanceDetailEntity extends AttendanceListItemEntity {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({
    nullable: true,
    example: { name: 'Reguler', startTime: '08:00', endTime: '17:00', lateToleranceMinutes: 15 },
  })
  shiftSnapshot: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: IdNameEntity, nullable: true })
  kiosk: IdNameEntity | null;

  @ApiPropertyOptional({ type: IdNameEntity, nullable: true })
  location: IdNameEntity | null;

  @ApiPropertyOptional({ type: IdNameEntity, nullable: true, description: 'Petugas (QR personal)' })
  scannedBy: IdNameEntity | null;

  @ApiPropertyOptional({ type: AttendanceLeaveRefEntity, nullable: true })
  leaveRequest: AttendanceLeaveRefEntity | null;

  @ApiProperty({ type: [ScanLogEntity], description: 'Semua percobaan scan user pada tanggal ini' })
  scanLogs: ScanLogEntity[];

  @ApiProperty({ example: '2026-10-19T00:50:20.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-19T10:05:40.000Z' })
  updatedAt: Date;
}

export class MonthlySummaryEntity {
  @ApiProperty({ example: 15 }) present: number;
  @ApiProperty({ example: 3 }) late: number;
  @ApiProperty({ example: 1 }) absent: number;
  @ApiProperty({ example: 1 }) sick: number;
  @ApiProperty({ example: 0 }) permit: number;
  @ApiProperty({ example: 0 }) leave: number;
  @ApiProperty({ example: 62 }) totalLateMinutes: number;
  @ApiProperty({ example: 9480 }) totalWorkMinutes: number;
  @ApiProperty({
    example: 20,
    description:
      'Hari dihitung: hari kerja terjadwal yang sudah lewat sejak bergabung + hari lain yang punya record',
  })
  workingDays: number;
  @ApiProperty({ example: 90, description: '(present + late) / workingDays × 100, maks 100' })
  attendanceRate: number;
}

export class MonthlyAttendanceEntity {
  @ApiProperty({ example: '2026-10' })
  month: string;

  @ApiProperty({ type: [AttendanceEntity] })
  items: AttendanceEntity[];

  @ApiProperty({ type: MonthlySummaryEntity })
  summary: MonthlySummaryEntity;
}

export class RecalculateResultEntity {
  @ApiProperty({ example: '2026-10-19' }) date: string;
  @ApiProperty({ example: 120 }) processed: number;
  @ApiProperty({ example: 8 }) created: number;
  @ApiProperty({ example: 1 }) updated: number;
  @ApiPropertyOptional({ enum: ['HOLIDAY'], nullable: true, example: null }) skipped: string | null;
  @ApiProperty({ example: 342 }) durationMs: number;
}
