import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { HEALTH_ROUTES } from './health.constants';
import { HealthService, type HealthStatus } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get(HEALTH_ROUTES)
  @ApiOperation({ summary: 'Cek kesehatan layanan' })
  @ApiOkResponse({
    description: 'Layanan sehat',
    schema: {
      example: { success: true, data: { status: 'ok', time: '2026-10-11T01:05:22.000Z' } },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'Ada dependensi yang tidak sehat' })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
