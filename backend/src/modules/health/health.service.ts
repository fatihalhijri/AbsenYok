import { Injectable } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';

export interface HealthStatus {
  status: 'ok';
  db: 'up';
  time: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /** Melempar ServiceUnavailableException (503) bila ada indikator yang gagal. */
  async check(): Promise<HealthStatus> {
    await this.health.check([() => this.database.pingCheck()]);
    return { status: 'ok', db: 'up', time: new Date().toISOString() };
  }
}
