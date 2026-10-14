import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@/common/constants/roles';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiDataResponse, ApiStandardErrors } from '@/common/swagger/api-response.decorators';
import {
  DashboardSummaryEntity,
  LateRankingEntity,
  RankingQueryDto,
  RecentActivityEntity,
  TrendPointEntity,
  TrendQueryDto,
} from './dashboard.dto';
import {
  type DashboardSummary,
  DashboardService,
  type LateRankingItem,
  type RecentActivity,
  type TrendPoint,
} from './dashboard.service';

/** Cache 30 detik (kunci = URL, sama untuk semua admin) — kecuali recent-activity. */
const DASHBOARD_CACHE_MS = 30_000;

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(DASHBOARD_CACHE_MS)
  @ApiOperation({ summary: 'Ringkasan kehadiran hari ini (cache 30 detik)' })
  @ApiDataResponse(DashboardSummaryEntity)
  summary(): Promise<DashboardSummary> {
    return this.dashboard.summary();
  }

  @Get('trend')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(DASHBOARD_CACHE_MS)
  @ApiOperation({ summary: 'Tren harian per status (default 30 hari, cache 30 detik)' })
  @ApiDataResponse(TrendPointEntity, { isArray: true })
  trend(@Query() query: TrendQueryDto): Promise<TrendPoint[]> {
    return this.dashboard.trend(query.days);
  }

  @Get('late-ranking')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(DASHBOARD_CACHE_MS)
  @ApiOperation({ summary: 'Top 10 akumulasi keterlambatan per bulan (cache 30 detik)' })
  @ApiDataResponse(LateRankingEntity, { isArray: true })
  lateRanking(@Query() query: RankingQueryDto): Promise<LateRankingItem[]> {
    return this.dashboard.lateRanking(query.month);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: '20 absensi masuk/pulang terbaru hari ini (tanpa cache)' })
  @ApiDataResponse(RecentActivityEntity, { isArray: true })
  recentActivity(): Promise<RecentActivity[]> {
    return this.dashboard.recentActivity();
  }
}
