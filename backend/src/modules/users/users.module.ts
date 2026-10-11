import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '@/modules/auth/auth.module';
import { AvatarService } from './avatar.service';
import { UserIntegrityService } from './user-integrity.service';
import { UsersImportService } from './users-import.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MULTER_MAX_BYTES } from './users.constants';

@Module({
  imports: [
    AuthModule,
    // Memory storage (default); batas ukuran per endpoint dicek ulang di service.
    MulterModule.register({ limits: { fileSize: MULTER_MAX_BYTES, files: 1, fields: 5 } }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersImportService, UserIntegrityService, AvatarService],
})
export class UsersModule {}
