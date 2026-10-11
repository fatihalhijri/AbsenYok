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
  ApiPaginatedResponse,
  ApiStandardErrors,
} from '@/common/swagger/api-response.decorators';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { CreateShiftDto, ShiftQueryDto, UpdateShiftDto } from './dto/shift.dto';
import { ShiftEntity } from './entities/shift.entity';
import { ShiftsService, type ShiftView } from './shifts.service';

@ApiTags('Shifts')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar shift', description: 'sortBy: name | startTime | createdAt' })
  @ApiPaginatedResponse(ShiftEntity)
  list(@Query() query: ShiftQueryDto): Promise<PaginatedResult<ShiftView>> {
    return this.shifts.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail shift' })
  @ApiDataResponse(ShiftEntity)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  findOne(@Param('id', ParseIdPipe) id: string): Promise<ShiftView> {
    return this.shifts.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah shift' })
  @ApiDataResponse(ShiftEntity, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Nama shift sudah digunakan')
  create(@Body() dto: CreateShiftDto): Promise<ShiftView> {
    return this.shifts.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Ubah shift',
    description: 'Tidak mengubah absensi lama (absensi menyimpan shiftSnapshot).',
  })
  @ApiDataResponse(ShiftEntity)
  update(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateShiftDto): Promise<ShiftView> {
    return this.shifts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus shift', description: 'Ditolak bila masih dipakai karyawan' })
  @ApiNullDataResponse('Shift dihapus')
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Shift masih dipakai karyawan')
  async remove(@Param('id', ParseIdPipe) id: string): Promise<null> {
    await this.shifts.remove(id);
    return null;
  }
}
