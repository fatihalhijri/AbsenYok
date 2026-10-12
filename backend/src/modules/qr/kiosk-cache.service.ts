import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/** Data kiosk yang dibutuhkan verifikasi QR & geofence (BE-06). */
export interface CachedKiosk {
  id: string;
  name: string;
  secret: string;
  qrIntervalSeconds: number;
  isActive: boolean;
  location: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    isActive: boolean;
  };
}

export const KIOSK_CACHE_TTL_MS = 60_000;

/**
 * Cache kiosk 60 detik (kiosk dipindai berkali-kali per menit). WAJIB `invalidate()` saat kiosk
 * diubah, dihapus, atau secret dirotasi agar QR lama langsung tidak berlaku.
 * `secret` hanya untuk perhitungan di server — jangan pernah dikirim ke client.
 */
@Injectable()
export class KioskCacheService {
  private readonly entries = new Map<string, { kiosk: CachedKiosk; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async get(kioskId: string, now: number = Date.now()): Promise<CachedKiosk | null> {
    const cached = this.entries.get(kioskId);
    if (cached && cached.expiresAt > now) return cached.kiosk;

    const row = await this.prisma.kiosk.findUnique({
      where: { id: kioskId },
      select: {
        id: true,
        name: true,
        secret: true,
        qrIntervalSeconds: true,
        isActive: true,
        location: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            radiusMeters: true,
            isActive: true,
          },
        },
      },
    });
    if (!row) {
      this.entries.delete(kioskId);
      return null;
    }

    const kiosk: CachedKiosk = {
      ...row,
      location: {
        ...row.location,
        latitude: row.location.latitude.toNumber(),
        longitude: row.location.longitude.toNumber(),
      },
    };
    this.entries.set(kioskId, { kiosk, expiresAt: now + KIOSK_CACHE_TTL_MS });
    return kiosk;
  }

  invalidate(kioskId: string): void {
    this.entries.delete(kioskId);
  }

  /** Lokasi berubah memengaruhi banyak kiosk sekaligus. */
  invalidateAll(): void {
    this.entries.clear();
  }
}
