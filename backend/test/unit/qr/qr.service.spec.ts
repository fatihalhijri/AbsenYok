import { createHmac, randomBytes } from 'node:crypto';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { AppConfigService } from '@/config/app.config';
import type { Env } from '@/config/env.schema';
import { KioskCacheService } from '@/modules/qr/kiosk-cache.service';
import { parseQrToken } from '@/modules/qr/qr-token';
import { personalReplayTtlMs, QrService } from '@/modules/qr/qr.service';
import type { PrismaService } from '@/prisma/prisma.service';

const KIOSK_A = '11111111-1111-4111-8111-111111111111';
const KIOSK_B = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const QR_SIGNING_SECRET = 'q'.repeat(64);

/** 2026-10-12 08:00:05 WIB — 5 detik setelah awal window 30 detik. */
const NOW = new Date('2026-10-12T01:00:05.000Z');
const at = (offsetSeconds: number) => new Date(NOW.getTime() + offsetSeconds * 1000);

interface KioskRow {
  id: string;
  name: string;
  secret: string;
  qrIntervalSeconds: number;
  isActive: boolean;
  location: {
    id: string;
    name: string;
    latitude: { toNumber(): number };
    longitude: { toNumber(): number };
    radiusMeters: number;
    isActive: boolean;
  };
}

const kioskRow = (id: string, overrides: Partial<KioskRow> = {}): KioskRow => ({
  id,
  name: `Kiosk ${id.slice(0, 4)}`,
  secret: randomBytes(64).toString('hex'),
  qrIntervalSeconds: 30,
  isActive: true,
  location: {
    id: 'loc-1',
    name: 'Kantor Pusat',
    latitude: { toNumber: () => -6.2 },
    longitude: { toNumber: () => 106.8166667 },
    radiusMeters: 100,
    isActive: true,
  },
  ...overrides,
});

async function codeOf(run: () => unknown): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof BusinessException) return error.code;
    throw error;
  }
}

/** Pemanggilan sinkron harus melempar BusinessException dengan kode tertentu. */
function expectThrowsCode(run: () => unknown, code: ErrorCode): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BusinessException);
  expect((caught as BusinessException).code).toBe(code);
}

describe('QrService', () => {
  let kiosks: Map<string, KioskRow>;
  let findUnique: jest.Mock;
  let cache: KioskCacheService;
  let qr: QrService;

  beforeEach(() => {
    kiosks = new Map([
      [KIOSK_A, kioskRow(KIOSK_A)],
      [KIOSK_B, kioskRow(KIOSK_B)],
    ]);
    findUnique = jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(kiosks.get(where.id) ?? null),
    );
    const prisma = { kiosk: { findUnique } } as unknown as PrismaService;
    const env: Partial<Env> = { QR_SIGNING_SECRET, QR_PERSONAL_INTERVAL_SECONDS: 60 };
    const config = { get: (key: keyof Env) => env[key] } as unknown as AppConfigService;
    cache = new KioskCacheService(prisma);
    qr = new QrService(config, cache);
  });

  const kioskToken = (id = KIOSK_A, now = NOW) => {
    const row = kiosks.get(id);
    if (!row) throw new Error('kiosk fixture tidak ada');
    return qr.generateKioskToken(row, now);
  };

  describe('token kiosk', () => {
    it('format AY1.K.<kioskId>.<window>.<signature 22> sesuai QR-SECURITY.md', () => {
      const { token, window, expiresAt } = kioskToken();
      const row = kiosks.get(KIOSK_A)!;

      expect(window).toBe(Math.floor(NOW.getTime() / 1000 / 30));
      const expectedSignature = createHmac('sha256', row.secret)
        .update(`AY1.K.${KIOSK_A}.${window}`)
        .digest('base64url')
        .slice(0, 22);
      expect(token).toBe(`AY1.K.${KIOSK_A}.${window}.${expectedSignature}`);
      // Berakhir di batas window berikutnya (08:00:30 WIB).
      expect(expiresAt.toISOString()).toBe('2026-10-12T01:00:30.000Z');
    });

    it('token valid diterima dan mengembalikan data kiosk untuk geofence', async () => {
      const { token, window } = kioskToken();
      const result = await qr.verifyKioskToken(token, NOW);

      expect(result).toMatchObject({ kioskId: KIOSK_A, window });
      expect(result.kiosk.location).toMatchObject({ latitude: -6.2, radiusMeters: 100 });
    });

    it('token window sebelumnya masih diterima (toleransi 1 window)', async () => {
      const { token } = kioskToken(KIOSK_A, at(-30));
      await expect(qr.verifyKioskToken(token, NOW)).resolves.toMatchObject({ kioskId: KIOSK_A });
    });

    it('token 2 window lalu → QR_EXPIRED', async () => {
      const { token } = kioskToken(KIOSK_A, at(-60));
      await expect(codeOf(() => qr.verifyKioskToken(token, NOW))).resolves.toBe(
        ErrorCode.QR_EXPIRED,
      );
    });

    it('token window masa depan → QR_EXPIRED', async () => {
      const { token } = kioskToken(KIOSK_A, at(60));
      await expect(codeOf(() => qr.verifyKioskToken(token, NOW))).resolves.toBe(
        ErrorCode.QR_EXPIRED,
      );
    });

    it('signature diubah 1 karakter → QR_INVALID', async () => {
      const { token } = kioskToken();
      const last = token.at(-1);
      const tampered = `${token.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
      await expect(codeOf(() => qr.verifyKioskToken(tampered, NOW))).resolves.toBe(
        ErrorCode.QR_INVALID,
      );
    });

    it('token kiosk A dipakai dengan id kiosk B (secret berbeda) → QR_INVALID', async () => {
      const { token } = kioskToken(KIOSK_A);
      const forged = token.replace(KIOSK_A, KIOSK_B);
      await expect(codeOf(() => qr.verifyKioskToken(forged, NOW))).resolves.toBe(
        ErrorCode.QR_INVALID,
      );
    });

    it('kiosk tidak terdaftar → QR_INVALID', async () => {
      const { token } = kioskToken();
      kiosks.delete(KIOSK_A);
      cache.invalidate(KIOSK_A);
      await expect(codeOf(() => qr.verifyKioskToken(token, NOW))).resolves.toBe(
        ErrorCode.QR_INVALID,
      );
    });

    it('setelah rotate secret (cache di-invalidate) → token lama QR_INVALID', async () => {
      const { token } = kioskToken();
      await expect(qr.verifyKioskToken(token, NOW)).resolves.toBeDefined();

      kiosks.set(KIOSK_A, { ...kiosks.get(KIOSK_A)!, secret: randomBytes(64).toString('hex') });
      cache.invalidate(KIOSK_A);

      await expect(codeOf(() => qr.verifyKioskToken(token, NOW))).resolves.toBe(
        ErrorCode.QR_INVALID,
      );
      // Token yang dibuat dengan secret baru diterima.
      await expect(qr.verifyKioskToken(kioskToken().token, NOW)).resolves.toBeDefined();
    });

    it('kiosk atau lokasinya nonaktif → KIOSK_INACTIVE (setelah signature valid)', async () => {
      const { token } = kioskToken();
      kiosks.set(KIOSK_A, { ...kiosks.get(KIOSK_A)!, isActive: false });
      cache.invalidate(KIOSK_A);
      await expect(codeOf(() => qr.verifyKioskToken(token, NOW))).resolves.toBe(
        ErrorCode.KIOSK_INACTIVE,
      );

      const row = kiosks.get(KIOSK_A)!;
      kiosks.set(KIOSK_A, {
        ...row,
        isActive: true,
        location: { ...row.location, isActive: false },
      });
      cache.invalidate(KIOSK_A);
      await expect(codeOf(() => qr.verifyKioskToken(token, NOW))).resolves.toBe(
        ErrorCode.KIOSK_INACTIVE,
      );
    });

    it('cache kiosk 60 detik: verifikasi berulang tidak query ulang database', async () => {
      const { token } = kioskToken();
      await qr.verifyKioskToken(token, NOW);
      await qr.verifyKioskToken(token, at(10));
      expect(findUnique).toHaveBeenCalledTimes(1);

      // Setelah TTL habis dimuat ulang.
      await qr.verifyKioskToken(kioskToken(KIOSK_A, at(61)).token, at(61));
      expect(findUnique).toHaveBeenCalledTimes(2);
    });

    it('mengikuti qrIntervalSeconds per kiosk', async () => {
      kiosks.set(KIOSK_A, { ...kiosks.get(KIOSK_A)!, qrIntervalSeconds: 10 });
      const { token, expiresAt } = kioskToken();
      expect(expiresAt.toISOString()).toBe('2026-10-12T01:00:10.000Z');
      await expect(codeOf(() => qr.verifyKioskToken(token, at(20)))).resolves.toBe(
        ErrorCode.QR_EXPIRED,
      );
    });
  });

  describe('input sampah → QR_INVALID (tidak pernah crash)', () => {
    const validToken = () => kioskToken().token;

    it.each([
      ['string kosong', ''],
      ['string acak', 'halo dunia'],
      ['URL', 'https://absenyok.id/scan?k=123'],
      ['> 200 karakter', `AY1.K.${KIOSK_A}.1.${'a'.repeat(200)}`],
      ['versi salah', `AY2.K.${KIOSK_A}.59372161.${'a'.repeat(22)}`],
      ['tipe personal ke verifikasi kiosk', `AY1.P.${KIOSK_A}.59372161.${'a'.repeat(22)}`],
      ['id bukan UUID', `AY1.K.not-a-uuid.59372161.${'a'.repeat(22)}`],
      ['window bukan angka', `AY1.K.${KIOSK_A}.abc.${'a'.repeat(22)}`],
      ['window negatif', `AY1.K.${KIOSK_A}.-1.${'a'.repeat(22)}`],
      ['signature terlalu pendek', `AY1.K.${KIOSK_A}.59372161.abc`],
      ['signature karakter ilegal', `AY1.K.${KIOSK_A}.59372161.${'+'.repeat(22)}`],
      ['bagian berlebih', `AY1.K.${KIOSK_A}.59372161.${'a'.repeat(22)}.extra`],
      ['injeksi SQL', `AY1.K.' OR 1=1 --.1.${'a'.repeat(22)}`],
      ['karakter unicode', '🚀'.repeat(30)],
    ])('%s', async (_label, input) => {
      await expect(codeOf(() => qr.verifyKioskToken(input, NOW))).resolves.toBe(
        ErrorCode.QR_INVALID,
      );
      expect(findUnique).not.toHaveBeenCalled();
    });

    it.each([null, undefined, 12345, { token: 'x' }, ['AY1']])(
      'nilai non-string (%p)',
      async (input) => {
        await expect(
          codeOf(() => qr.verifyKioskToken(input as unknown as string, NOW)),
        ).resolves.toBe(ErrorCode.QR_INVALID);
        expectThrowsCode(
          () => qr.verifyPersonalToken(input as unknown as string, NOW),
          ErrorCode.QR_INVALID,
        );
      },
    );

    it('parseQrToken tidak melempar untuk token valid yang dipotong di posisi mana pun', () => {
      const token = validToken();
      for (let length = 0; length < token.length; length += 1) {
        expect(() => parseQrToken(token.slice(0, length), 'K')).not.toThrow();
      }
    });
  });

  describe('token personal', () => {
    it('format AY1.P.<userId>.<window>.<signature> dengan QR_SIGNING_SECRET, interval 60 detik', () => {
      const { token, window, expiresAt } = qr.generatePersonalToken(USER_ID, NOW);
      const signature = createHmac('sha256', QR_SIGNING_SECRET)
        .update(`AY1.P.${USER_ID}.${window}`)
        .digest('base64url')
        .slice(0, 22);
      expect(token).toBe(`AY1.P.${USER_ID}.${window}.${signature}`);
      expect(window).toBe(Math.floor(NOW.getTime() / 1000 / 60));
      expect(expiresAt.toISOString()).toBe('2026-10-12T01:01:00.000Z');
    });

    it('valid, window sebelumnya diterima, 2 window lalu → QR_EXPIRED', () => {
      expect(qr.verifyPersonalToken(qr.generatePersonalToken(USER_ID, NOW).token, NOW)).toEqual({
        userId: USER_ID,
        window: Math.floor(NOW.getTime() / 1000 / 60),
      });
      expect(
        qr.verifyPersonalToken(qr.generatePersonalToken(USER_ID, at(-60)).token, NOW).userId,
      ).toBe(USER_ID);
      expectThrowsCode(
        () => qr.verifyPersonalToken(qr.generatePersonalToken(USER_ID, at(-120)).token, NOW),
        ErrorCode.QR_EXPIRED,
      );
    });

    it('token kiosk tidak bisa dipakai sebagai token personal (dan sebaliknya)', async () => {
      expectThrowsCode(() => qr.verifyPersonalToken(kioskToken().token, NOW), ErrorCode.QR_INVALID);
      const personal = qr.generatePersonalToken(USER_ID, NOW).token;
      await expect(codeOf(() => qr.verifyKioskToken(personal, NOW))).resolves.toBe(
        ErrorCode.QR_INVALID,
      );
    });

    it('userId diganti (signature tidak cocok) → QR_INVALID', () => {
      const { token } = qr.generatePersonalToken(USER_ID, NOW);
      expectThrowsCode(
        () => qr.verifyPersonalToken(token.replace(USER_ID, KIOSK_A), NOW),
        ErrorCode.QR_INVALID,
      );
    });

    it('replay token personal setelah dipakai → QR_ALREADY_USED (dipesan saat verifikasi)', () => {
      const { token } = qr.generatePersonalToken(USER_ID, NOW);
      qr.verifyPersonalToken(token, NOW);

      // Request kedua ditolak walau request pertama belum selesai disimpan.
      expectThrowsCode(() => qr.verifyPersonalToken(token, at(5)), ErrorCode.QR_ALREADY_USED);
      // Token window berikutnya (QR baru di layar HP) tetap bisa dipakai.
      expect(
        qr.verifyPersonalToken(qr.generatePersonalToken(USER_ID, at(60)).token, at(60)).userId,
      ).toBe(USER_ID);
    });

    it('penanda replay kedaluwarsa setelah 120 detik (token sudah expired juga)', () => {
      const { token } = qr.generatePersonalToken(USER_ID, NOW);
      qr.verifyPersonalToken(token, NOW);
      expectThrowsCode(() => qr.verifyPersonalToken(token, at(121)), ErrorCode.QR_EXPIRED);
    });

    it('scan gagal → pesanan dilepas, token yang sama bisa dicoba lagi', () => {
      const { token } = qr.generatePersonalToken(USER_ID, NOW);
      const verified = qr.verifyPersonalToken(token, NOW);
      qr.releasePersonalToken(verified);
      expect(qr.verifyPersonalToken(token, at(5)).userId).toBe(USER_ID);
    });

    it('TTL anti-replay = 2 × interval (mencakup seluruh masa berlaku token)', () => {
      expect(personalReplayTtlMs(60)).toBe(120_000);
      expect(personalReplayTtlMs(90)).toBe(180_000);
    });
  });
});
