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
import type { AuthUser } from '@/common/types/auth-user.type';
import { UserProfileEntity } from '@/modules/auth/entities/auth.entity';
import { PersonalQrEntity } from '@/modules/kiosks/entities/kiosk.entity';
import { QrService } from '@/modules/qr/qr.service';
import type { UserProfile } from '@/modules/auth/user-profile';
import { AvatarService } from './avatar.service';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateMeDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';
import { AvatarEntity, ImportResultEntity, UserEntity } from './entities/user.entity';
import type { UserDetail } from './user.select';
import { type ImportResult, UsersImportService } from './users-import.service';
import { UsersService } from './users.service';
import { XLSX_MIME } from './users.constants';

interface PersonalQr {
  token: string;
  expiresAt: Date;
  intervalSeconds: number;
}

const FILE_BODY = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

const IMPORT_ERROR_EXAMPLE = {
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: '1 baris tidak valid; tidak ada data yang disimpan',
    details: [{ row: 3, field: 'email', messages: ['Email duplikat dengan baris 2'] }],
  },
  path: '/api/v1/users/import',
  timestamp: '2026-10-11T01:05:22.000Z',
};

@ApiTags('Users')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly importer: UsersImportService,
    private readonly avatars: AvatarService,
    private readonly qr: QrService,
  ) {}

  // ----------------------------- profil sendiri -----------------------------

  @Patch('me')
  @ApiOperation({ summary: 'Ubah profil sendiri (nama & telepon)' })
  @ApiDataResponse(UserProfileEntity)
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMeDto,
    @ClientInfo() client: ClientInfo,
  ): Promise<UserProfile> {
    return this.users.updateMe(userId, dto, client);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiOperation({
    summary: 'Unggah foto profil',
    description: 'JPG/PNG/WEBP (dicek dari isi file) maks 2 MB; disimpan 256×256 WEBP.',
  })
  @ApiDataResponse(AvatarEntity)
  updateAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ avatarUrl: string }> {
    return this.avatars.updateAvatar(userId, file);
  }

  @Get('me/qr')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({
    summary: 'QR personal (mode cadangan)',
    description:
      'Berganti tiap QR_PERSONAL_INTERVAL_SECONDS (default 60 detik); dipindai petugas lewat ' +
      '`POST /attendance/personal-scan`.',
  })
  @ApiDataResponse(PersonalQrEntity)
  myQr(@CurrentUser('id') userId: string): PersonalQr {
    const { token, expiresAt } = this.qr.generatePersonalToken(userId);
    return { token, expiresAt, intervalSeconds: this.qr.personalInterval };
  }

  // ------------------------------- import XLSX -------------------------------

  @Get('import/template')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Unduh template import karyawan (XLSX)' })
  @ApiProduces(XLSX_MIME)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File template-import-karyawan.xlsx',
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async importTemplate(): Promise<StreamableFile> {
    const buffer = await this.importer.buildTemplate();
    return new StreamableFile(buffer, {
      type: XLSX_MIME,
      disposition: 'attachment; filename="template-import-karyawan.xlsx"',
      length: buffer.length,
    });
  }

  @Post('import')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @ApiOperation({
    summary: 'Import karyawan dari XLSX',
    description:
      'Semua baris divalidasi dulu. Bila ada error, tidak ada yang disimpan dan `details` ' +
      'berisi error per baris (`row` = nomor baris Excel). Maks 500 baris / 5 MB.',
  })
  @ApiDataResponse(ImportResultEntity, { status: HttpStatus.CREATED })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Ada baris tidak valid',
    schema: { example: IMPORT_ERROR_EXAMPLE },
  })
  importUsers(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<ImportResult> {
    return this.importer.import(file, actor, client);
  }

  // ---------------------------------- admin ----------------------------------

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Daftar pengguna',
    description:
      'search: nama/email/kode karyawan. sortBy: name | employeeCode | email | createdAt | lastLoginAt',
  })
  @ApiPaginatedResponse(UserEntity)
  list(@Query() query: UserQueryDto): Promise<PaginatedResult<UserDetail>> {
    return this.users.list(query);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Detail pengguna' })
  @ApiDataResponse(UserEntity)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
  findOne(@Param('id', ParseIdPipe) id: string): Promise<UserDetail> {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Tambah pengguna',
    description: 'ADMIN hanya boleh membuat role EMPLOYEE; SUPER_ADMIN boleh semua role.',
  })
  @ApiDataResponse(UserEntity, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Email/kode karyawan sudah digunakan')
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<UserDetail> {
    return this.users.create(dto, actor, client);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Ubah pengguna (tanpa password)' })
  @ApiDataResponse(UserEntity)
  @ApiErrorResponse(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'Email/kode karyawan sudah digunakan')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<UserDetail> {
    return this.users.update(id, dto, actor, client);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Aktifkan / nonaktifkan pengguna',
    description: 'Nonaktif → semua sesi (refresh token) dicabut. Tidak bisa untuk akun sendiri.',
  })
  @ApiDataResponse(UserEntity)
  setStatus(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<UserDetail> {
    return this.users.setStatus(id, dto.isActive, actor, client);
  }

  @Post(':id/reset-password')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password pengguna',
    description: 'Membuka kunci akun dan mencabut semua sesi pengguna tersebut.',
  })
  @ApiNullDataResponse('Password direset')
  async resetPassword(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<null> {
    await this.users.resetPassword(id, dto.newPassword, actor, client);
    return null;
  }

  @Post(':id/reset-device')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset perangkat terdaftar',
    description: 'Mengosongkan device binding; perangkat berikutnya yang scan akan terikat.',
  })
  @ApiDataResponse(UserEntity)
  resetDevice(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<UserDetail> {
    return this.users.resetDevice(id, actor, client);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hapus pengguna (soft delete, SUPER_ADMIN)',
    description: 'Data absensi tetap disimpan. Email & kode karyawan tidak dapat dipakai ulang.',
  })
  @ApiNullDataResponse('Pengguna dihapus')
  async remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ClientInfo() client: ClientInfo,
  ): Promise<null> {
    await this.users.remove(id, actor, client);
    return null;
  }
}
