import { Injectable } from '@nestjs/common';
import { Role } from '@/common/constants/roles';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { forbiddenError, notFoundError } from '@/common/exceptions/error-factories';
import type { PaginatedResult } from '@/common/types/api-response.type';
import type { AuthUser } from '@/common/types/auth-user.type';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import { hashPassword } from '@/common/utils/password.util';
import { resolveOrderBy } from '@/common/utils/sort.util';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { UserAuthCacheService } from '@/modules/auth/user-auth-cache.service';
import { toUserProfile, USER_PROFILE_SELECT, type UserProfile } from '@/modules/auth/user-profile';
import {
  type CreateUserDto,
  type UpdateMeDto,
  type UpdateUserDto,
  USER_SORT_FIELDS,
  type UserQueryDto,
} from './dto/user.dto';
import { assertCanAssignRole, assertCanManageUser } from './user-access.policy';
import { UserIntegrityService } from './user-integrity.service';
import { toUserDetail, type UserDetail, USER_SAFE_SELECT } from './user.select';

/** Field yang dicatat sebagai before/after di audit USER_UPDATED. */
const AUDITED_FIELDS = [
  'employeeCode',
  'name',
  'email',
  'phone',
  'position',
  'role',
  'departmentId',
  'shiftId',
  'locationId',
] as const;

type AuditedField = (typeof AUDITED_FIELDS)[number];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly userCache: UserAuthCacheService,
    private readonly integrity: UserIntegrityService,
  ) {}

  async list(query: UserQueryDto): Promise<PaginatedResult<UserDetail>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      role: query.role,
      departmentId: query.departmentId,
      isActive: query.isActive,
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { email: { contains: query.search } },
          { employeeCode: { contains: query.search } },
        ],
      }),
    };
    const orderBy = resolveOrderBy(query.sortBy, query.sortOrder, USER_SORT_FIELDS, 'createdAt');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy, select: USER_SAFE_SELECT, ...toSkipTake(query) }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map(toUserDetail), total, query);
  }

  async findOne(id: string): Promise<UserDetail> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SAFE_SELECT,
    });
    if (!row) throw notFoundError('Pengguna tidak ditemukan');
    return toUserDetail(row);
  }

  async create(dto: CreateUserDto, actor: AuthUser, client: ClientInfo): Promise<UserDetail> {
    const role = dto.role ?? Role.EMPLOYEE;
    assertCanAssignRole(actor, role);
    await this.integrity.assertRelations(dto);
    await this.integrity.assertUniqueIdentity(dto);

    const { password, ...data } = dto;
    const passwordHash = await hashPassword(password);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { ...data, role, passwordHash },
        select: USER_SAFE_SELECT,
      });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.USER_CREATED,
          entity: 'User',
          entityId: created.id,
          metadata: { employeeCode: created.employeeCode, role },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
      return created;
    });
    return toUserDetail(row);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthUser,
    client: ClientInfo,
  ): Promise<UserDetail> {
    const target = await this.findManageable(id);
    assertCanManageUser(actor, target, { allowSelf: true });
    if (dto.role !== undefined && dto.role !== target.role) {
      if (actor.id === target.id)
        throw forbiddenError('Anda tidak dapat mengubah role akun sendiri');
      assertCanAssignRole(actor, dto.role);
    }
    await this.integrity.assertRelations(dto);
    await this.integrity.assertUniqueIdentity(
      { email: dto.email, employeeCode: dto.employeeCode },
      id,
    );

    const changes = AUDITED_FIELDS.filter(
      (field) => dto[field] !== undefined && dto[field] !== target[field],
    );
    if (changes.length === 0) return this.findOne(id);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: dto, select: USER_SAFE_SELECT });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.USER_UPDATED,
          entity: 'User',
          entityId: id,
          metadata: {
            before: pick(target, changes),
            after: pick<AuditedField>(dto, changes),
          },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
      return updated;
    });

    // Role & email dipakai JwtAuthGuard (cache 30 detik) — buang agar langsung berlaku.
    if (changes.includes('role') || changes.includes('email')) await this.userCache.invalidate(id);
    return toUserDetail(row);
  }

  /** Nonaktifkan → seluruh refresh token dicabut; tidak bisa pada akun sendiri. */
  async setStatus(
    id: string,
    isActive: boolean,
    actor: AuthUser,
    client: ClientInfo,
  ): Promise<UserDetail> {
    const target = await this.findManageable(id);
    assertCanManageUser(actor, target);
    if (target.isActive === isActive) return this.findOne(id);

    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive },
        select: USER_SAFE_SELECT,
      });
      const revoked = isActive
        ? 0
        : (
            await tx.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: now },
            })
          ).count;
      await this.audit.log(
        {
          actorId: actor.id,
          action: isActive ? AuditAction.USER_UPDATED : AuditAction.USER_DEACTIVATED,
          entity: 'User',
          entityId: id,
          metadata: {
            before: { isActive: !isActive },
            after: { isActive },
            revokedSessions: revoked,
          },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
      return updated;
    });

    await this.userCache.invalidate(id);
    return toUserDetail(row);
  }

  /** Password baru + buka kunci akun + cabut semua sesi. */
  async resetPassword(
    id: string,
    newPassword: string,
    actor: AuthUser,
    client: ClientInfo,
  ): Promise<void> {
    const target = await this.findManageable(id);
    assertCanManageUser(actor, target);
    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      const { count } = await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.PASSWORD_CHANGED,
          entity: 'User',
          entityId: id,
          metadata: { reason: 'ADMIN_RESET', revokedSessions: count },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
    });
  }

  /** Lepas device binding agar karyawan bisa mendaftarkan HP baru saat scan berikutnya. */
  async resetDevice(id: string, actor: AuthUser, client: ClientInfo): Promise<UserDetail> {
    const target = await this.findManageable(id);
    assertCanManageUser(actor, target, { allowSelf: true });

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { boundDeviceId: null },
        select: USER_SAFE_SELECT,
      });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.DEVICE_RESET,
          entity: 'User',
          entityId: id,
          metadata: { wasBound: target.boundDeviceId !== null },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
      return updated;
    });
    return toUserDetail(row);
  }

  /** Soft delete (SUPER_ADMIN): data absensi tetap utuh, sesi dicabut. */
  async remove(id: string, actor: AuthUser, client: ClientInfo): Promise<void> {
    const target = await this.findManageable(id);
    assertCanManageUser(actor, target);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { deletedAt: now, isActive: false } });
      const { count } = await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.USER_DEACTIVATED,
          entity: 'User',
          entityId: id,
          metadata: {
            softDeleted: true,
            employeeCode: target.employeeCode,
            revokedSessions: count,
          },
          ip: client.ipAddress,
          userAgent: client.userAgent,
        },
        tx,
      );
    });
    await this.userCache.invalidate(id);
  }

  /** Profil sendiri: hanya nama & telepon. Mengembalikan `UserProfile` (sama dengan /auth/me). */
  async updateMe(userId: string, dto: UpdateMeDto, client: ClientInfo): Promise<UserProfile> {
    const current = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true, phone: true },
    });
    if (!current) throw notFoundError('Pengguna tidak ditemukan');

    const changes = (['name', 'phone'] as const).filter(
      (field) => dto[field] !== undefined && dto[field] !== current[field],
    );
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: dto,
        select: USER_PROFILE_SELECT,
      });
      if (changes.length > 0) {
        await this.audit.log(
          {
            actorId: userId,
            action: AuditAction.USER_UPDATED,
            entity: 'User',
            entityId: userId,
            metadata: {
              before: pick(current, changes),
              after: pick(dto, changes),
              self: true,
            },
            ip: client.ipAddress,
            userAgent: client.userAgent,
          },
          tx,
        );
      }
      return updated;
    });
    return toUserProfile(row);
  }

  private async findManageable(id: string) {
    const target = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        role: true,
        isActive: true,
        boundDeviceId: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        departmentId: true,
        shiftId: true,
        locationId: true,
      },
    });
    if (!target) throw notFoundError('Pengguna tidak ditemukan');
    return target;
  }
}

/** Ambil field (semuanya string/null) untuk metadata audit before/after. */
function pick<K extends string>(
  source: Partial<Record<K, string | null>>,
  keys: readonly K[],
): Record<string, string | null> {
  return Object.fromEntries(keys.map((key) => [key, source[key] ?? null]));
}
