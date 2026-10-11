import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@/common/constants/roles';
import { ClientInfo } from '@/common/decorators/client-info.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiDataResponse, ApiStandardErrors } from '@/common/swagger/api-response.decorators';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { PublicSettingsEntity, SettingsEntity } from './entities/setting.entity';
import type { SettingValues } from './setting-definitions';
import { type PublicSettings, SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiStandardErrors()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Pengaturan publik (nama instansi & logo) untuk halaman login' })
  @ApiDataResponse(PublicSettingsEntity)
  getPublic(): Promise<PublicSettings> {
    return this.settings.getPublic();
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Semua pengaturan sistem' })
  @ApiDataResponse(SettingsEntity)
  getAll(): Promise<SettingValues> {
    return this.settings.getAll();
  }

  @Patch()
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ubah pengaturan (SUPER_ADMIN)',
    description: 'Kirim hanya key yang diubah. Setiap perubahan dicatat sebagai SETTING_UPDATED.',
  })
  @ApiDataResponse(SettingsEntity)
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser('id') actorId: string,
    @ClientInfo() client: ClientInfo,
  ): Promise<SettingValues> {
    return this.settings.update(dto, actorId, client);
  }
}
