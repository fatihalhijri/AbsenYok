import { Module } from '@nestjs/common';
import { AttendanceAdminController } from './attendance-admin.controller';
import { AttendanceAdminService } from './attendance-admin.service';
import { AttendanceContextLoader } from './attendance-context.loader';
import { AttendanceHistoryService } from './attendance-history.service';
import { AttendanceRecalculateService } from './attendance-recalculate.service';
import { AttendanceRulesService } from './attendance-rules.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DeviceBindingService } from './device-binding.service';
import { GeofenceService } from './geofence.service';
import { ScanLogService } from './scan-log.service';
import { PersonalScanThrottleGuard, ScanThrottleGuard } from './scan-throttle.guard';

@Module({
  // Urutan penting: rute statis AttendanceController didaftarkan sebelum `:id` milik admin.
  controllers: [AttendanceController, AttendanceAdminController],
  providers: [
    AttendanceService,
    AttendanceRulesService,
    AttendanceContextLoader,
    GeofenceService,
    DeviceBindingService,
    ScanLogService,
    ScanThrottleGuard,
    PersonalScanThrottleGuard,
    AttendanceHistoryService,
    AttendanceAdminService,
    AttendanceRecalculateService,
  ],
  exports: [AttendanceRulesService, AttendanceRecalculateService],
})
export class AttendanceModule {}
