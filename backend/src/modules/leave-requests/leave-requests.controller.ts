import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { ClientInfo } from '@/common/decorators/client-info.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import {
  ApiDataResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
  ApiStandardErrors,
} from '@/common/swagger/api-response.decorators';
import type { PaginatedResult } from '@/common/types/api-response.type';
import type { AuthUser } from '@/common/types/auth-user.type';
import {
  ApproveLeaveDto,
  CreateLeaveRequestDto,
  LeaveQueryDto,
  MyLeaveQueryDto,
  QuotaQueryDto,
  RejectLeaveDto,
} from './dto/leave-request.dto';
import { LeaveQuotaEntity, LeaveRequestEntity } from './entities/leave-request.entity';
import { type LeaveQuota, LeaveRequestsService, type LeaveView } from './leave-requests.service';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaves: LeaveRequestsService) {}

  // ------------------------------- karyawan -------------------------------

  @Post()
  @Roles(Role.EMPLOYEE)
  @UseInterceptors(FileInterceptor('attachment'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'startDate', 'endDate', 'reason'],
      properties: {
        type: { type: 'string', enum: ['SICK', 'PERMIT', 'ANNUAL'], example: 'SICK' },
        startDate: { type: 'string', example: '2026-10-22' },
        endDate: { type: 'string', example: '2026-10-23' },
        reason: { type: 'string', example: 'Demam tinggi, disarankan istirahat oleh dokter' },
        attachment: {
          type: 'string',
          format: 'binary',
          description: 'JPG/PNG/PDF ≤ 2 MB; wajib untuk SICK > 1 hari',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Ajukan izin/sakit/cuti',
    description:
      'startDate maks 7 hari ke belakang; rentang ≤ leave.maxRangeDays; tidak boleh tumpang tindih ' +
      'dengan PENDING/APPROVED; totalDays = hari kerja (tanpa akhir pekan & libur).',
  })
  @ApiDataResponse(LeaveRequestEntity, { status: HttpStatus.CREATED })
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    ErrorCode.CONFLICT,
    'Tanggal bertabrakan dengan pengajuan lain',
  )
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLeaveRequestDto,
    @UploadedFile() attachment: Express.Multer.File | undefined,
  ): Promise<LeaveView> {
    return this.leaves.create(userId, dto, attachment);
  }

  @Get('me')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Pengajuan saya (per tahun)' })
  @ApiDataResponse(LeaveRequestEntity, { isArray: true })
  myList(@CurrentUser('id') userId: string, @Query() query: MyLeaveQueryDto): Promise<LeaveView[]> {
    return this.leaves.myList(userId, query);
  }

  @Get('me/quota')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Kuota cuti tahunan saya' })
  @ApiDataResponse(LeaveQuotaEntity)
  myQuota(@CurrentUser('id') userId: string, @Query() query: QuotaQueryDto): Promise<LeaveQuota> {
    return this.leaves.quota(userId, query.year);
  }

  @Patch(':id/cancel')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Batalkan pengajuan sendiri (hanya PENDING)' })
  @ApiDataResponse(LeaveRequestEntity)
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Status bukan PENDING')
  cancel(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIdPipe) id: string,
  ): Promise<LeaveView> {
    return this.leaves.cancel(userId, id);
  }

  // --------------------------------- admin ---------------------------------

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Daftar pengajuan (admin)',
    description:
      'dateFrom/dateTo: pengajuan yang beririsan. sortBy: createdAt | startDate | totalDays',
  })
  @ApiPaginatedResponse(LeaveRequestEntity)
  adminList(@Query() query: LeaveQueryDto): Promise<PaginatedResult<LeaveView>> {
    return this.leaves.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail pengajuan (admin atau pemilik)' })
  @ApiDataResponse(LeaveRequestEntity)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  findOne(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<LeaveView> {
    return this.leaves.findOne(id, actor);
  }

  @Get(':id/attachment')
  @ApiOperation({
    summary: 'Unduh lampiran (pemilik, ADMIN, SUPER_ADMIN)',
    description: 'Lampiran tidak pernah disajikan lewat folder statis publik.',
  })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File lampiran',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Tidak ada lampiran')
  async attachment(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.leaves.attachment(id, actor);
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.stream, {
      type: file.mime,
      length: file.size,
      disposition: `inline; filename="lampiran-${id}.${file.ext}"`,
    });
  }

  @Patch(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Setujui pengajuan',
    description:
      'Absensi ABSENT pada tanggal tercakup yang sudah lewat langsung diubah menjadi ' +
      'SICK/PERMIT/LEAVE. Dicatat LEAVE_APPROVED.',
  })
  @ApiDataResponse(LeaveRequestEntity)
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    ErrorCode.CONFLICT,
    'Status bukan PENDING / kuota tidak cukup',
  )
  approve(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: ApproveLeaveDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<LeaveView> {
    return this.leaves.approve(id, actor, dto.note, client);
  }

  @Patch(':id/reject')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Tolak pengajuan (note wajib)', description: 'Dicatat LEAVE_REJECTED.' })
  @ApiDataResponse(LeaveRequestEntity)
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Status bukan PENDING')
  reject(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: RejectLeaveDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<LeaveView> {
    return this.leaves.reject(id, actor, dto.note, client);
  }
}
