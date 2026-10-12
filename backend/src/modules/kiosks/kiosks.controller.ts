import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { ClientInfo } from '@/common/decorators/client-info.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import {
  ApiDataResponse,
  ApiErrorResponse,
  ApiNullDataResponse,
  ApiPaginatedResponse,
  ApiStandardErrors,
} from '@/common/swagger/api-response.decorators';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { CreateKioskDto, KioskQueryDto, UpdateKioskDto } from './dto/kiosk.dto';
import { KioskEntity, KioskQrEntity, RecentScanEntity } from './entities/kiosk.entity';
import { type KioskQr, KiosksService, type KioskView, type RecentScan } from './kiosks.service';

@ApiTags('Kiosks')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('kiosks')
export class KiosksController {
  constructor(private readonly kiosks: KiosksService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar kiosk', description: 'sortBy: name | createdAt | lastSeenAt' })
  @ApiPaginatedResponse(KioskEntity)
  list(@Query() query: KioskQueryDto): Promise<PaginatedResult<KioskView>> {
    return this.kiosks.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail kiosk (tanpa secret)' })
  @ApiDataResponse(KioskEntity)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  findOne(@Param('id', ParseIdPipe) id: string): Promise<KioskView> {
    return this.kiosks.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Tambah kiosk',
    description: 'Secret 64 byte dibuat otomatis di server.',
  })
  @ApiDataResponse(KioskEntity, { status: HttpStatus.CREATED })
  create(@Body() dto: CreateKioskDto): Promise<KioskView> {
    return this.kiosks.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah kiosk' })
  @ApiDataResponse(KioskEntity)
  update(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateKioskDto): Promise<KioskView> {
    return this.kiosks.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hapus kiosk',
    description: 'Ditolak bila sudah punya riwayat absensi — nonaktifkan saja.',
  })
  @ApiNullDataResponse('Kiosk dihapus')
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Kiosk sudah memiliki riwayat absensi')
  async remove(@Param('id', ParseIdPipe) id: string): Promise<null> {
    await this.kiosks.remove(id);
    return null;
  }

  @Post(':id/rotate-secret')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotasi secret kiosk',
    description: 'Semua QR lama langsung tidak berlaku. Dicatat sebagai KIOSK_SECRET_ROTATED.',
  })
  @ApiDataResponse(KioskEntity)
  rotateSecret(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('id') actorId: string,
    @ClientInfo() client: ClientInfo,
  ): Promise<KioskView> {
    return this.kiosks.rotateSecret(id, actorId, client);
  }

  @Get(':id/qr')
  @ApiOperation({
    summary: 'Token QR terkini untuk layar kiosk',
    description: 'Dipolling ±5 detik. `serverTime` untuk sinkronisasi hitung mundur.',
  })
  @ApiDataResponse(KioskQrEntity)
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.KIOSK_INACTIVE)
  getCurrentQr(@Param('id', ParseIdPipe) id: string): Promise<KioskQr> {
    return this.kiosks.getCurrentQr(id);
  }

  @Get(':id/recent-scans')
  @ApiOperation({ summary: '10 scan berhasil terakhir hari ini (untuk layar kiosk)' })
  @ApiDataResponse(RecentScanEntity, { isArray: true })
  recentScans(@Param('id', ParseIdPipe) id: string): Promise<RecentScan[]> {
    return this.kiosks.recentScans(id);
  }
}
