import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LeaveAttachmentStorage } from './leave-attachment.storage';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';

@Module({
  imports: [
    // Memory storage; batas pasti (MAX_UPLOAD_SIZE_MB) dicek ulang di LeaveAttachmentStorage.
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 } }),
  ],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, LeaveAttachmentStorage],
})
export class LeaveRequestsModule {}
