import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@/common/constants/roles';
import { ClientInfo } from '@/common/decorators/client-info.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiDataResponse, ApiStandardErrors } from '@/common/swagger/api-response.decorators';
import type { AuthUser } from '@/common/types/auth-user.type';
import { AttendanceHistoryService, type MonthlyAttendance } from './attendance-history.service';
import { AttendanceService, type MyTodayStatus, type ScanResult } from './attendance.service';
import { MonthQueryDto } from './dto/attendance-admin.dto';
import { PersonalScanDto, ScanKioskDto } from './dto/scan.dto';
import {
  MonthlyAttendanceEntity,
  MyTodayEntity,
  ScanResultEntity,
} from './entities/attendance.entity';
import { PersonalScanThrottleGuard, ScanThrottleGuard } from './scan-throttle.guard';

const SCAN_ERROR_EXAMPLE = {
  success: false,
  error: {
    code: 'OUTSIDE_GEOFENCE',
    message: 'Anda berada 245 m dari lokasi kantor (maks 100 m)',
    details: { distance: 245, radius: 100 },
  },
  path: '/api/v1/attendance/scan',
  timestamp: '2026-10-12T01:05:22.000Z',
};

const SCAN_ERRORS_DESCRIPTION =
  'Kode: QR_INVALID, QR_EXPIRED, QR_ALREADY_USED (personal), KIOSK_INACTIVE, DEVICE_MISMATCH, ' +
  'LOCATION_ACCURACY_LOW, OUTSIDE_GEOFENCE, NO_SHIFT_ASSIGNED, NOT_WORKING_DAY, HOLIDAY, ON_LEAVE, ' +
  'CHECKIN_WINDOW_CLOSED, CHECKOUT_TOO_SOON';

@ApiTags('Attendance')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly history: AttendanceHistoryService,
  ) {}

  @Post('scan')
  @Roles(Role.EMPLOYEE)
  @UseGuards(ScanThrottleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan QR kiosk (absen masuk/pulang otomatis)',
    description: 'Maks 10 scan/menit per user. Setiap percobaan dicatat di attendance_scan_logs.',
  })
  @ApiDataResponse(ScanResultEntity)
  @ApiResponse({
    status: 422,
    description: SCAN_ERRORS_DESCRIPTION,
    schema: { example: SCAN_ERROR_EXAMPLE },
  })
  @ApiResponse({ status: 409, description: 'ALREADY_CHECKED_IN / ALREADY_CHECKED_OUT' })
  @ApiResponse({ status: 429, description: 'TOO_MANY_REQUESTS (details.retryAfterSeconds)' })
  scan(
    @CurrentUser() user: AuthUser,
    @Body() dto: ScanKioskDto,
    @ClientInfo() client: ClientInfo,
  ): Promise<ScanResult> {
    return this.attendance.scanKiosk(user, dto, client);
  }

  @Post('personal-scan')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseGuards(PersonalScanThrottleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan QR personal karyawan (mode cadangan, oleh petugas)',
    description:
      'Device binding dilewati; geofence memakai koordinat petugas terhadap locationId. ' +
      'Token yang sama tidak bisa dipakai dua kali (QR_ALREADY_USED).',
  })
  @ApiDataResponse(ScanResultEntity)
  @ApiResponse({ status: 422, description: SCAN_ERRORS_DESCRIPTION })
  personalScan(
    @CurrentUser() officer: AuthUser,
    @Body() dto: PersonalScanDto,
    @ClientInfo() client: ClientInfo,
  ): Promise<ScanResult> {
    return this.attendance.scanPersonal(officer, dto, client);
  }

  @Get('me/today')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Status absensi hari ini (kartu beranda karyawan)' })
  @ApiDataResponse(MyTodayEntity)
  myToday(@CurrentUser('id') userId: string): Promise<MyTodayStatus> {
    return this.attendance.getMyToday(userId);
  }

  @Get('me')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Riwayat absensi saya per bulan + ringkasan',
    description:
      'attendanceRate = (present + late) / hari kerja yang sudah lewat × 100 (1 desimal)',
  })
  @ApiDataResponse(MonthlyAttendanceEntity)
  myMonth(
    @CurrentUser('id') userId: string,
    @Query() query: MonthQueryDto,
  ): Promise<MonthlyAttendance> {
    return this.history.myMonth(userId, query.month);
  }
}
