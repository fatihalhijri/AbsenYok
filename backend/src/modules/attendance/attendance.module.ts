import { Module } from '@nestjs/common';
import { AttendanceContextLoader } from './attendance-context.loader';
import { AttendanceRulesService } from './attendance-rules.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DeviceBindingService } from './device-binding.service';
import { GeofenceService } from './geofence.service';
import { ScanLogService } from './scan-log.service';
import { ScanThrottleGuard } from './scan-throttle.guard';

@Module({
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceRulesService,
    AttendanceContextLoader,
    GeofenceService,
    DeviceBindingService,
    ScanLogService,
    ScanThrottleGuard,
  ],
  exports: [AttendanceRulesService],
})
export class AttendanceModule {}
