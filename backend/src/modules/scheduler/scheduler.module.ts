import { Module } from '@nestjs/common';
import { AttendanceModule } from '@/modules/attendance/attendance.module';
import { DailyAttendanceCron } from './daily-attendance.cron';

/** Tugas terjadwal lintas modul (cron harian absensi). */
@Module({
  imports: [AttendanceModule],
  providers: [DailyAttendanceCron],
})
export class SchedulerModule {}
