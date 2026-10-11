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
import { CreateLocationDto, LocationQueryDto, UpdateLocationDto } from './dto/location.dto';
import { LocationEntity } from './entities/location.entity';
import { LocationsService, type LocationView } from './locations.service';

@ApiTags('Locations')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar lokasi kantor', description: 'sortBy: name | createdAt' })
  @ApiPaginatedResponse(LocationEntity)
  list(@Query() query: LocationQueryDto): Promise<PaginatedResult<LocationView>> {
    return this.locations.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail lokasi' })
  @ApiDataResponse(LocationEntity)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  findOne(@Param('id', ParseIdPipe) id: string): Promise<LocationView> {
    return this.locations.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah lokasi + geofence' })
  @ApiDataResponse(LocationEntity, { status: HttpStatus.CREATED })
  create(@Body() dto: CreateLocationDto): Promise<LocationView> {
    return this.locations.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah lokasi' })
  @ApiDataResponse(LocationEntity)
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationView> {
    return this.locations.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus lokasi', description: 'Ditolak bila masih dipakai kiosk' })
  @ApiNullDataResponse('Lokasi dihapus')
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Lokasi masih dipakai kiosk')
  async remove(@Param('id', ParseIdPipe) id: string): Promise<null> {
    await this.locations.remove(id);
    return null;
  }
}
