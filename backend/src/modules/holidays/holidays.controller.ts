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
import { Roles } from '@/common/decorators/roles.decorator';
import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import {
  ApiDataResponse,
  ApiErrorResponse,
  ApiNullDataResponse,
  ApiStandardErrors,
} from '@/common/swagger/api-response.decorators';
import {
  BulkCreateHolidayDto,
  CreateHolidayDto,
  HolidayQueryDto,
  UpdateHolidayDto,
} from './dto/holiday.dto';
import { BulkHolidayResultEntity, HolidayEntity } from './entities/holiday.entity';
import { type BulkHolidayResult, HolidaysService, type HolidayView } from './holidays.service';

@ApiTags('Holidays')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar hari libur per tahun',
    description: 'Dapat diakses semua role (dipakai kalender karyawan).',
  })
  @ApiDataResponse(HolidayEntity, { isArray: true })
  list(@Query() query: HolidayQueryDto): Promise<HolidayView[]> {
    return this.holidays.list(query);
  }

  @Post('bulk')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Tambah banyak hari libur sekaligus',
    description: `Maksimal 100 tanggal; tanggal yang sudah ada dilewati.`,
  })
  @ApiDataResponse(BulkHolidayResultEntity, { status: HttpStatus.CREATED })
  bulkCreate(@Body() dto: BulkCreateHolidayDto): Promise<BulkHolidayResult> {
    return this.holidays.bulkCreate(dto);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Tambah hari libur' })
  @ApiDataResponse(HolidayEntity, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Tanggal sudah terdaftar')
  create(@Body() dto: CreateHolidayDto): Promise<HolidayView> {
    return this.holidays.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Ubah hari libur' })
  @ApiDataResponse(HolidayEntity)
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Tanggal sudah terdaftar')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ): Promise<HolidayView> {
    return this.holidays.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus hari libur' })
  @ApiNullDataResponse('Hari libur dihapus')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  async remove(@Param('id', ParseIdPipe) id: string): Promise<null> {
    await this.holidays.remove(id);
    return null;
  }
}
