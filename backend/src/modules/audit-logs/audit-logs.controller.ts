import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@/common/constants/roles';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiPaginatedResponse, ApiStandardErrors } from '@/common/swagger/api-response.decorators';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { AuditLogsService, type AuditLogView } from './audit-logs.service';
import { AuditLogEntity, AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles(Role.SUPER_ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Audit log aktivitas sensitif (SUPER_ADMIN)',
    description: 'Filter action/actorId/entity/entityId/dateFrom/dateTo; search: nama/email aktor.',
  })
  @ApiPaginatedResponse(AuditLogEntity)
  list(@Query() query: AuditLogQueryDto): Promise<PaginatedResult<AuditLogView>> {
    return this.auditLogs.list(query);
  }
}
