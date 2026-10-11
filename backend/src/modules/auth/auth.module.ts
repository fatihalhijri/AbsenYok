import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenCleanupTask } from './refresh-token-cleanup.task';
import { TokenService } from './token.service';
import { UserAuthCacheService } from './user-auth-cache.service';

@Module({
  // Secret & masa berlaku diberikan per pemanggilan di TokenService (access ≠ refresh).
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthCookieService,
    UserAuthCacheService,
    RefreshTokenCleanupTask,
  ],
  exports: [TokenService, UserAuthCacheService],
})
export class AuthModule {}
