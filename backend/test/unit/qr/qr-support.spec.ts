import { KIOSK_CACHE_TTL_MS, KioskCacheService } from '@/modules/qr/kiosk-cache.service';
import { ReplayGuard } from '@/modules/qr/replay-guard';
import type { PrismaService } from '@/prisma/prisma.service';

describe('ReplayGuard', () => {
  it('kunci yang belum pernah dipakai → false', () => {
    expect(new ReplayGuard(1000).has('a', 0)).toBe(false);
  });

  it('kunci dipakai → true selama TTL, lalu dilupakan', () => {
    const guard = new ReplayGuard(1000);
    guard.add('a', 0);
    expect(guard.has('a', 999)).toBe(true);
    expect(guard.has('a', 1000)).toBe(false);
    expect(guard.size).toBe(0);
  });

  it('entri kedaluwarsa dibersihkan saat ada penambahan (memori tidak tumbuh tanpa batas)', () => {
    const guard = new ReplayGuard(1000);
    guard.add('a', 0);
    guard.add('b', 500);
    guard.add('c', 1200);
    expect(guard.size).toBe(2);
    expect(guard.has('b', 1200)).toBe(true);
  });

  it('memakai waktu sekarang bila argumen `now` tidak diberikan', () => {
    const guard = new ReplayGuard(60_000);
    guard.add('x');
    expect(guard.has('x')).toBe(true);
  });
});

describe('KioskCacheService', () => {
  const decimal = (value: number) => ({ toNumber: () => value });
  const row = {
    id: 'k1',
    name: 'Lobi',
    secret: 's'.repeat(64),
    qrIntervalSeconds: 30,
    isActive: true,
    location: {
      id: 'l1',
      name: 'Kantor Pusat',
      latitude: decimal(-6.2),
      longitude: decimal(106.81),
      radiusMeters: 100,
      isActive: true,
    },
  };

  function setup(result: unknown = row) {
    const findUnique = jest.fn().mockResolvedValue(result);
    const prisma = { kiosk: { findUnique } } as unknown as PrismaService;
    return { cache: new KioskCacheService(prisma), findUnique };
  }

  it('memuat kiosk sekali lalu memakai cache selama 60 detik (koordinat jadi number)', async () => {
    const { cache, findUnique } = setup();
    const kiosk = await cache.get('k1', 0);
    expect(kiosk?.location).toMatchObject({ latitude: -6.2, longitude: 106.81 });
    await cache.get('k1', KIOSK_CACHE_TTL_MS - 1);
    expect(findUnique).toHaveBeenCalledTimes(1);

    await cache.get('k1', KIOSK_CACHE_TTL_MS);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('kiosk tidak ada → null (tidak di-cache)', async () => {
    const { cache, findUnique } = setup(null);
    await expect(cache.get('k1', 0)).resolves.toBeNull();
    await cache.get('k1', 1);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('invalidate & invalidateAll memaksa muat ulang', async () => {
    const { cache, findUnique } = setup();
    await cache.get('k1', 0);
    cache.invalidate('k1');
    await cache.get('k1', 1);
    cache.invalidateAll();
    await cache.get('k1', 2);
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it('query yang selesai SETELAH rotasi secret (invalidate) tidak menyimpan secret lama', async () => {
    const { cache, findUnique } = setup();
    let releaseOld!: (value: unknown) => void;
    findUnique.mockImplementationOnce(() => new Promise((resolve) => (releaseOld = resolve)));
    const pending = cache.get('k1', 0);
    cache.invalidate('k1');
    releaseOld(row);
    await pending;

    await cache.get('k1', 1);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('memakai waktu sekarang bila argumen `now` tidak diberikan', async () => {
    const { cache, findUnique } = setup();
    await cache.get('k1');
    await cache.get('k1');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
