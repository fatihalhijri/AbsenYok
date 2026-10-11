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
import { DepartmentsService, type DepartmentView } from './departments.service';
import { CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from './dto/department.dto';
import { DepartmentEntity } from './entities/department.entity';

@ApiTags('Departments')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar departemen', description: 'sortBy: code | name | createdAt' })
  @ApiPaginatedResponse(DepartmentEntity)
  list(@Query() query: DepartmentQueryDto): Promise<PaginatedResult<DepartmentView>> {
    return this.departments.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail departemen' })
  @ApiDataResponse(DepartmentEntity)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  findOne(@Param('id', ParseIdPipe) id: string): Promise<DepartmentView> {
    return this.departments.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah departemen' })
  @ApiDataResponse(DepartmentEntity, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Kode/nama sudah digunakan')
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentView> {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah departemen' })
  @ApiDataResponse(DepartmentEntity)
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Kode/nama sudah digunakan')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentView> {
    return this.departments.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hapus departemen',
    description: 'Ditolak bila masih ada karyawan aktif',
  })
  @ApiNullDataResponse('Departemen dihapus')
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Masih ada karyawan aktif')
  async remove(@Param('id', ParseIdPipe) id: string): Promise<null> {
    await this.departments.remove(id);
    return null;
  }
}
