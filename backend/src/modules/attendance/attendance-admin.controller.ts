import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClockService } from '@/common/clock/clock.service';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { ClientInfo } from '@/common/decorators/client-info.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { conflictError, fieldError } from '@/common/exceptions/error-factories';
import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import {
  ApiDataResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
  ApiStandardErrors,
} from '@/common/swagger/api-response.decorators';
import type { PaginatedResult } from '@/common/types/api-response.type';
import type { AuthUser } from '@/common/types/auth-user.type';
import { toTzDateString } from '@/common/utils/date.util';
import {
  type AttendanceDetail,
  type AttendanceListItem,
  AttendanceAdminService,
  type ScanLogView,
} from './attendance-admin.service';
import {
  AttendanceRecalculateService,
  type RecalculateResult,
} from './attendance-recalculate.service';
import type { AttendanceView } from './attendance.view';
import {
  AttendanceQueryDto,
  CorrectAttendanceDto,
  ManualAttendanceDto,
  RecalculateQueryDto,
  ScanLogQueryDto,
} from './dto/attendance-admin.dto';
import {
  AttendanceDetailEntity,
  AttendanceEntity,
  AttendanceListItemEntity,
  RecalculateResultEntity,
  ScanLogEntity,
} from './entities/attendance.entity';

/**
 * Endpoint admin absensi. Didaftarkan SETELAH AttendanceController sehingga rute statis
 * (`me`, `me/today`, `scan-logs`, …) tidak tertangkap `:id`.
 */
@ApiTags('Attendance')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('attendance')
export class AttendanceAdminController {
  constructor(
    private readonly admin: AttendanceAdminService,
    private readonly recalculate: AttendanceRecalculateService,
    private readonly clock: ClockService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar absensi (admin)',
    description:
      'Default: awal bulan s/d hari ini; rentang maks 92 hari. search: nama/NIP. ' +
      'sortBy: date | checkInAt | lateMinutes | workMinutes | createdAt',
  })
  @ApiPaginatedResponse(AttendanceListItemEntity)
  list(@Query() query: AttendanceQueryDto): Promise<PaginatedResult<AttendanceListItem>> {
    return this.admin.list(query);
  }

  @Get('scan-logs')
  @ApiOperation({
    summary: 'Log percobaan scan (deteksi kecurangan)',
    description: 'Gunakan `success=false` untuk halaman "Log Scan Gagal". Rentang maks 92 hari.',
  })
  @ApiPaginatedResponse(ScanLogEntity)
  scanLogs(@Query() query: ScanLogQueryDto): Promise<PaginatedResult<ScanLogView>> {
    return this.admin.scanLogs(query);
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Buat absensi manual (karyawan lupa absen)',
    description:
      'Ditolak bila record tanggal itu sudah ada — gunakan PATCH. Dicatat ATTENDANCE_MANUAL_CREATED.',
  })
  @ApiDataResponse(AttendanceEntity, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Record tanggal tersebut sudah ada')
  createManual(
    @Body() dto: ManualAttendanceDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<AttendanceView> {
    return this.admin.createManual(dto, actor, client);
  }

  @Post('recalculate')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Jalankan ulang penandaan harian (SUPER_ADMIN)',
    description:
      'Proses yang sama dengan cron 23:55: ABSENT untuk yang tidak hadir, SICK/PERMIT/LEAVE ' +
      'untuk cuti disetujui. Idempoten. Tanggal masa depan ditolak.',
  })
  @ApiDataResponse(RecalculateResultEntity)
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Rekalkulasi lain sedang berjalan')
  async recalculateDate(@Query() query: RecalculateQueryDto): Promise<RecalculateResult> {
    if (query.date > toTzDateString(this.clock.now())) {
      throw fieldError('date', 'Tanggal tidak boleh di masa depan');
    }
    const outcome = await this.recalculate.withLock(() => this.recalculate.run(query.date));
    if (!outcome.acquired) {
      throw conflictError('Rekalkulasi sedang berjalan, coba lagi beberapa saat lagi');
    }
    return outcome.result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail absensi + log scan pada tanggal yang sama' })
  @ApiDataResponse(AttendanceDetailEntity)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  findOne(@Param('id', ParseIdPipe) id: string): Promise<AttendanceDetail> {
    return this.admin.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Koreksi absensi',
    description:
      'reason wajib (min 10 karakter). Metrik dihitung ulang dari shiftSnapshot; method sisi ' +
      'yang diubah menjadi MANUAL; audit ATTENDANCE_CORRECTED berisi before/after/reason.',
  })
  @ApiDataResponse(AttendanceEntity)
  correct(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<AttendanceView> {
    return this.admin.correct(id, dto, actor, client);
  }
}
