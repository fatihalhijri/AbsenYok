import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import { AppConfigService } from '@/config/app.config';
import { type CachedKiosk, KioskCacheService } from './kiosk-cache.service';
import {
  buildQrToken,
  currentWindow,
  isSignatureValid,
  isWindowAccepted,
  parseQrToken,
  windowEndsAt,
} from './qr-token';
import { ReplayGuard } from './replay-guard';

export interface GeneratedQrToken {
  token: string;
  /** Akhir window berjalan — saat layar harus menampilkan QR baru. */
  expiresAt: Date;
  window: number;
}

export interface VerifiedKioskToken {
  kioskId: string;
  window: number;
  kiosk: CachedKiosk;
}

export interface VerifiedPersonalToken {
  userId: string;
  window: number;
}

/**
 * Token personal diterima pada window-nya dan window berikutnya (toleransi 1 window), jadi
 * penanda "sudah dipakai" harus bertahan 2 × interval agar mencakup seluruh masa berlaku token.
 */
export const personalReplayTtlMs = (intervalSeconds: number) => 2 * intervalSeconds * 1000;

const qrInvalid = () => new BusinessException(ErrorCode.QR_INVALID);
const qrExpired = () => new BusinessException(ErrorCode.QR_EXPIRED);

/** Penerbitan & verifikasi token QR dinamis (docs/QR-SECURITY.md). Tanpa controller. */
@Injectable()
export class QrService {
  private readonly replayGuard: ReplayGuard;

  constructor(
    private readonly config: AppConfigService,
    private readonly kioskCache: KioskCacheService,
  ) {
    this.replayGuard = new ReplayGuard(personalReplayTtlMs(this.personalInterval));
  }

  generateKioskToken(
    kiosk: { id: string; secret: string; qrIntervalSeconds: number },
    now: Date = new Date(),
  ): GeneratedQrToken {
    const window = currentWindow(now, kiosk.qrIntervalSeconds);
    return {
      token: buildQrToken(kiosk.secret, 'K', kiosk.id, window),
      expiresAt: windowEndsAt(window, kiosk.qrIntervalSeconds),
      window,
    };
  }

  /**
   * Urutan (BUSINESS-RULES §7 langkah 2–3): format → kiosk ada → window (QR_EXPIRED)
   * → signature (QR_INVALID) → kiosk & lokasi aktif (KIOSK_INACTIVE).
   */
  async verifyKioskToken(token: string, now: Date = new Date()): Promise<VerifiedKioskToken> {
    const parsed = parseQrToken(token, 'K');
    if (!parsed) throw qrInvalid();

    const kiosk = await this.kioskCache.get(parsed.subjectId, now.getTime());
    if (!kiosk) throw qrInvalid();

    if (!isWindowAccepted(parsed.window, currentWindow(now, kiosk.qrIntervalSeconds))) {
      throw qrExpired();
    }
    if (!isSignatureValid(kiosk.secret, parsed)) throw qrInvalid();
    if (!kiosk.isActive || !kiosk.location.isActive) {
      throw new BusinessException(ErrorCode.KIOSK_INACTIVE);
    }

    return { kioskId: kiosk.id, window: parsed.window, kiosk };
  }

  generatePersonalToken(userId: string, now: Date = new Date()): GeneratedQrToken {
    const interval = this.personalInterval;
    const window = currentWindow(now, interval);
    return {
      token: buildQrToken(this.personalSecret, 'P', userId, window),
      expiresAt: windowEndsAt(window, interval),
      window,
    };
  }

  /**
   * Lempar QR_INVALID / QR_EXPIRED / QR_ALREADY_USED. Token yang valid langsung DIPESAN
   * (anti-replay atomik): request kedua dengan token yang sama ditolak walau request pertama
   * belum selesai disimpan. Bila scan gagal, panggil `releasePersonalToken` agar token yang
   * sama bisa dicoba lagi (mis. setelah petugas pindah ke dalam area kantor).
   */
  verifyPersonalToken(token: string, now: Date = new Date()): VerifiedPersonalToken {
    const parsed = parseQrToken(token, 'P');
    if (!parsed) throw qrInvalid();

    if (!isWindowAccepted(parsed.window, currentWindow(now, this.personalInterval))) {
      throw qrExpired();
    }
    if (!isSignatureValid(this.personalSecret, parsed)) throw qrInvalid();
    if (!this.replayGuard.tryAdd(replayKey(parsed.subjectId, parsed.window), now.getTime())) {
      throw new BusinessException(ErrorCode.QR_ALREADY_USED);
    }

    return { userId: parsed.subjectId, window: parsed.window };
  }

  /** Lepas pesanan token personal (scan gagal sebelum tersimpan). */
  releasePersonalToken(token: VerifiedPersonalToken): void {
    this.replayGuard.delete(replayKey(token.userId, token.window));
  }

  get personalInterval(): number {
    return this.config.get('QR_PERSONAL_INTERVAL_SECONDS');
  }

  private get personalSecret(): string {
    return this.config.get('QR_SIGNING_SECRET');
  }
}

const replayKey = (userId: string, window: number) => `${userId.toLowerCase()}:${window}`;
