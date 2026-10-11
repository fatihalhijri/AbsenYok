import { Injectable } from '@nestjs/common';
import { HealthCheckService, type HealthIndicatorFunction } from '@nestjs/terminus';

export interface HealthStatus {
  status: 'ok';
  time: string;
}

@Injectable()
export class HealthService {
  /** Indikator kesehatan (cek database ditambahkan di BE-02). */
  private readonly indicators: HealthIndicatorFunction[] = [];

  constructor(private readonly health: HealthCheckService) {}

  /** Melempar ServiceUnavailableException (503) bila ada indikator yang gagal. */
  async check(): Promise<HealthStatus> {
    await this.health.check(this.indicators);
    return { status: 'ok', time: new Date().toISOString() };
  }
}
