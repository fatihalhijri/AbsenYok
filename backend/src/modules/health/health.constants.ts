import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';
import { API_PREFIX } from '@/common/constants/app.constants';

/**
 * Health tersedia di `/health` (untuk healthcheck container/load balancer) dan
 * `/api/v1/health` (lewat proxy frontend). Keduanya dikecualikan dari global prefix,
 * rute kedua menuliskan prefix secara eksplisit.
 */
export const HEALTH_ROUTES = ['health', `${API_PREFIX}/health`];

export const HEALTH_PREFIX_EXCLUDES: RouteInfo[] = HEALTH_ROUTES.map((path) => ({
  path,
  method: RequestMethod.GET,
}));
