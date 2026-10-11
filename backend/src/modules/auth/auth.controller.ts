import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ClientInfo } from '@/common/decorators/client-info.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthCookieService } from './auth-cookie.service';
import { LOGIN_THROTTLE, REFRESH_COOKIE_NAME } from './auth.constants';
import { AuthService, type AuthSession, type AuthTokenResponse } from './auth.service';
import { RefreshTokenCookie } from './decorators/refresh-token-cookie.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokenEntity, UserProfileEntity } from './entities/auth.entity';
import type { UserProfile } from './user-profile';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Public()
  @Throttle({ default: LOGIN_THROTTLE })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description: 'Mengembalikan access token dan memasang cookie `ay_rt` (refresh) & `ay_session`.',
  })
  @ApiOkResponse({ type: AuthTokenEntity })
  @ApiTooManyRequestsResponse({ description: 'Maksimal 5 percobaan per menit per IP' })
  async login(
    @Body() dto: LoginDto,
    @ClientInfo() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    const session = await this.authService.login(dto, client);
    return this.startSession(response, session);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: 'Perbarui access token (rotasi refresh token dari cookie)' })
  @ApiOkResponse({ type: AuthTokenEntity })
  async refresh(
    @RefreshTokenCookie() refreshToken: string | undefined,
    @ClientInfo() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    try {
      const session = await this.authService.refresh(refreshToken, client);
      return this.startSession(response, session);
    } catch (error) {
      this.cookies.clearSessionCookies(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout dari sesi saat ini' })
  @ApiOkResponse({ schema: { example: { success: true, data: null } } })
  async logout(
    @CurrentUser('id') userId: string,
    @RefreshTokenCookie() refreshToken: string | undefined,
    @ClientInfo() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.authService.logout(userId, refreshToken, client);
    this.cookies.clearSessionCookies(response);
    return null;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil user yang sedang login' })
  @ApiOkResponse({ type: UserProfileEntity })
  me(@CurrentUser('id') userId: string): Promise<UserProfile> {
    return this.authService.getProfile(userId);
  }

  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ganti password',
    description: 'Semua sesi (refresh token) dicabut; user perlu login ulang.',
  })
  @ApiOkResponse({ schema: { example: { success: true, data: null } } })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @ClientInfo() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.authService.changePassword(userId, dto, client);
    this.cookies.clearSessionCookies(response);
    return null;
  }

  private startSession(response: Response, session: AuthSession): AuthTokenResponse {
    this.cookies.setSessionCookies(response, session.refreshToken, session.refreshExpiresAt);
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }
}
