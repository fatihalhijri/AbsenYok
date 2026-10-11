import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { Role } from '@/common/constants/roles';
import { PrismaService } from '@/prisma/prisma.service';
import { AUTH_USER_CACHE_TTL_MS } from './auth.constants';

/** Data minimum yang dibutuhkan JwtAuthGuard. */
export interface CachedAuthUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
}

const cacheKey = (userId: string) => `auth:user:${userId}`;

/**
 * Cache status user (30 detik) agar guard tidak query DB di setiap request.
 * Panggil `invalidate()` setiap kali role/status/hapus user berubah agar langsung berlaku.
 */
@Injectable()
export class UserAuthCacheService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** `null` bila user tidak ada atau sudah dihapus (soft delete). */
  async get(userId: string): Promise<CachedAuthUser | null> {
    const cached = await this.cache.get<CachedAuthUser>(cacheKey(userId));
    if (cached) return cached;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user) return null;

    await this.cache.set(cacheKey(userId), user, AUTH_USER_CACHE_TTL_MS);
    return user;
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(cacheKey(userId));
  }
}
