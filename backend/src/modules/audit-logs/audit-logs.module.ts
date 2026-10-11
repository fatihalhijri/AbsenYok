import { Global, Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';

/** Global agar setiap modul bisa mencatat audit; controller pembacaan menyusul di BE-09. */
@Global()
@Module({
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
