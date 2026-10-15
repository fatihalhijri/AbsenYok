import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ErrorCode } from '@/common/constants/error-codes';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import { hashPassword, verifyPassword } from '@/common/utils/password.util';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import {
  ACCOUNT_LOCK_MINUTES,
  FAILED_LOGIN_WINDOW_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './auth.constants';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';
import { USER_PROFILE_SELECT, type UserProfile, toUserProfile } from './user-profile';

const MINUTE_MS = 60_000;
/** `metadata.reason` audit LOGIN_FAILED yang dihitung untuk lockout. */
const INVALID_PASSWORD_REASON = 'INVALID_PASSWORD';

/** Hasil login/refresh. `refreshToken` hanya untuk cookie — tidak pernah dikirim di body. */
export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: UserProfile;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export type AuthTokenResponse = Pick<AuthSession, 'accessToken' | 'expiresIn' | 'user'>;

interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
}

const invalidCredentials = () => new BusinessException(ErrorCode.INVALID_CREDENTIALS);
const tokenInvalid = () => new BusinessException(ErrorCode.TOKEN_INVALID);
const refreshTokenReused = () => new BusinessException(ErrorCode.REFRESH_TOKEN_REUSED);

const fieldError = (field: string, message: string) =>
  new BusinessException(ErrorCode.VALIDATION_ERROR, 'Data tidak valid', 400, [
    { field, messages: [message] },
  ]);

const latest = (...dates: (Date | null)[]): Date =>
  new Date(Math.max(...dates.filter((date): date is Date => date !== null).map(Number)));

@Injectable()
export class AuthService implements OnModuleInit {
  /** Hash acak untuk menyamakan waktu respons saat email tidak terdaftar. */
  private dummyPasswordHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditLogsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await hashPassword(randomBytes(32).toString('hex'));
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<AuthSession> {
    const now = new Date();
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        passwordHash: true,
        lockedUntil: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      // Tetap verifikasi agar waktu respons tidak membedakan email terdaftar/tidak.
      await verifyPassword(this.dummyPasswordHash, dto.password);
      await this.audit.log({
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        metadata: { email: dto.email, reason: 'UNKNOWN_EMAIL' },
        ip: client.ipAddress,
        userAgent: client.userAgent,
      });
      throw invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.audit.log({
        actorId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        entityId: user.id,
        metadata: { reason: 'ACCOUNT_LOCKED' },
        ip: client.ipAddress,
        userAgent: client.userAgent,
      });
      throw this.accountLocked(user.lockedUntil, now);
    }

    if (!(await verifyPassword(user.passwordHash, dto.password))) {
      await this.registerFailedLogin(user, client, now);
      throw invalidCredentials();
    }

    if (!user.isActive) {
      await this.audit.log({
        actorId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        entityId: user.id,
        metadata: { reason: 'ACCOUNT_INACTIVE' },
        ip: client.ipAddress,
        userAgent: client.userAgent,
      });
      throw new BusinessException(ErrorCode.ACCOUNT_INACTIVE);
    }

    const familyId = randomUUID();
    const refresh = await this.tokens.signRefreshToken(user.id, familyId);

    const profile = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
        select: USER_PROFILE_SELECT,
      });
      await tx.refreshToken.create({
        data: {
          id: refresh.jti,
          userId: user.id,
          tokenHash: this.tokens.hashToken(refresh.token),
          familyId,
          expiresAt: refresh.expiresAt,
          userAgent: client.userAgent,
          ipAddress: client.ipAddress,
        },
      });
      await this.audit.log(
        {
          actorId: user.id,
          action: AuditAction.LOGIN,
          entity: 'User',
          entityId: user.id,
          metadata: { familyId },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
      return updated;
    });

    const access = await this.tokens.signAccessToken(user);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      user: toUserProfile(profile),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  /**
   * Rotasi refresh token. Token yang sudah **dirotasi** (`replacedBy` terisi) dipakai lagi →
   * seluruh family dicabut (indikasi pencurian token) dan user wajib login ulang. Token yang
   * dicabut karena logout/ganti password/reset admin/nonaktif cukup ditolak TOKEN_INVALID
   * (bukan alarm pencurian).
   */
  async refresh(refreshToken: string | undefined, client: ClientInfo): Promise<AuthSession> {
    if (!refreshToken) throw tokenInvalid();

    const payload = await this.tokens.verifyRefreshToken(refreshToken);
    if (!payload) throw tokenInvalid();

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(refreshToken) },
      select: {
        id: true,
        userId: true,
        familyId: true,
        revokedAt: true,
        replacedBy: true,
        expiresAt: true,
      },
    });
    if (
      !record ||
      record.id !== payload.jti ||
      record.userId !== payload.sub ||
      record.familyId !== payload.familyId
    ) {
      throw tokenInvalid();
    }

    const now = new Date();
    if (record.revokedAt) {
      if (!record.replacedBy) throw tokenInvalid();
      await this.handleRefreshTokenReuse(record, client);
      throw refreshTokenReused();
    }
    if (record.expiresAt <= now) throw tokenInvalid();

    const user = await this.prisma.user.findFirst({
      where: { id: record.userId, deletedAt: null },
      select: { ...USER_PROFILE_SELECT, isActive: true },
    });
    if (!user) {
      await this.revokeFamily(record.familyId, now);
      throw tokenInvalid();
    }
    if (!user.isActive) {
      await this.revokeFamily(record.familyId, now);
      throw new BusinessException(ErrorCode.ACCOUNT_INACTIVE);
    }

    const next = await this.tokens.signRefreshToken(user.id, record.familyId);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Kondisi `revokedAt: null` mencegah dua request paralel merotasi token yang sama.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: now, replacedBy: next.jti },
      });
      if (count === 0) return false;

      await tx.refreshToken.create({
        data: {
          id: next.jti,
          userId: user.id,
          tokenHash: this.tokens.hashToken(next.token),
          familyId: record.familyId,
          expiresAt: next.expiresAt,
          userAgent: client.userAgent,
          ipAddress: client.ipAddress,
        },
      });
      return true;
    });

    if (!rotated) {
      await this.handleRefreshTokenReuse(record, client);
      throw refreshTokenReused();
    }

    const { isActive: _isActive, ...profile } = user;
    const access = await this.tokens.signAccessToken(user);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      user: toUserProfile(profile),
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    };
  }

  /** Cabut seluruh rantai token sesi ini (bila cookie ada) lalu catat audit. */
  async logout(
    userId: string,
    refreshToken: string | undefined,
    client: ClientInfo,
  ): Promise<void> {
    let familyId: string | null = null;

    if (refreshToken) {
      const record = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: this.tokens.hashToken(refreshToken) },
        select: { userId: true, familyId: true },
      });
      if (record?.userId === userId) {
        familyId = record.familyId;
        await this.revokeFamily(record.familyId, new Date());
      }
    }

    await this.audit.log({
      actorId: userId,
      action: AuditAction.LOGOUT,
      entity: 'User',
      entityId: userId,
      metadata: { familyId },
      ip: client.ipAddress,
      userAgent: client.userAgent,
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_PROFILE_SELECT,
    });
    if (!user) throw new BusinessException(ErrorCode.NOT_FOUND, 'Pengguna tidak ditemukan');
    return toUserProfile(user);
  }

  /** Ganti password lalu cabut SEMUA refresh token user (semua perangkat harus login ulang). */
  async changePassword(userId: string, dto: ChangePasswordDto, client: ClientInfo): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new BusinessException(ErrorCode.NOT_FOUND, 'Pengguna tidak ditemukan');

    if (!(await verifyPassword(user.passwordHash, dto.currentPassword))) {
      throw fieldError('currentPassword', 'Password saat ini salah');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw fieldError('newPassword', 'Password baru harus berbeda dari password saat ini');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      const { count } = await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.log(
        {
          actorId: user.id,
          action: AuditAction.PASSWORD_CHANGED,
          entity: 'User',
          entityId: user.id,
          metadata: { revokedSessions: count },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
    });
  }

  /**
   * Hitung kegagalan **password salah** sejak batas jendela: 15 menit terakhir, login sukses
   * terakhir, atau `lockedUntil` (akhir kunci sebelumnya / saat admin membuka kunci).
   * Percobaan saat akun terkunci/nonaktif tidak ikut dihitung. Kegagalan ke-5 → kunci 15 menit.
   */
  private async registerFailedLogin(
    user: { id: string; lastLoginAt: Date | null; lockedUntil: Date | null },
    client: ClientInfo,
    now: Date,
  ): Promise<void> {
    const windowStart = latest(
      new Date(now.getTime() - FAILED_LOGIN_WINDOW_MINUTES * MINUTE_MS),
      user.lastLoginAt,
      user.lockedUntil,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.audit.log(
        {
          actorId: user.id,
          action: AuditAction.LOGIN_FAILED,
          entity: 'User',
          entityId: user.id,
          metadata: { reason: INVALID_PASSWORD_REASON },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );

      const failures = await tx.auditLog.count({
        where: {
          actorId: user.id,
          action: AuditAction.LOGIN_FAILED,
          createdAt: { gte: windowStart },
          metadata: { path: '$.reason', equals: INVALID_PASSWORD_REASON },
        },
      });
      const shouldLock = failures >= MAX_FAILED_LOGIN_ATTEMPTS;

      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failures,
          ...(shouldLock && {
            lockedUntil: new Date(now.getTime() + ACCOUNT_LOCK_MINUTES * MINUTE_MS),
          }),
        },
      });
    });
  }

  private accountLocked(lockedUntil: Date, now: Date): BusinessException {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / MINUTE_MS));
    return new BusinessException(
      ErrorCode.ACCOUNT_LOCKED,
      `Akun dikunci sementara, coba lagi dalam ${minutes} menit`,
      undefined,
      { retryAfterMinutes: minutes },
    );
  }

  private async handleRefreshTokenReuse(
    record: RefreshTokenRecord,
    client: ClientInfo,
  ): Promise<void> {
    await this.revokeFamily(record.familyId, new Date());
    await this.audit.log({
      actorId: record.userId,
      action: AuditAction.REFRESH_TOKEN_REUSE_DETECTED,
      entity: 'RefreshToken',
      entityId: record.familyId,
      metadata: { tokenId: record.id },
      ip: client.ipAddress,
      userAgent: client.userAgent,
    });
  }

  private async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
