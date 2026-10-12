import { Injectable } from '@nestjs/common';

/**
 * Sumber waktu "sekarang" untuk logika bisnis yang bergantung jam (absensi, QR kiosk).
 * Di test dapat diganti dengan jam palsu agar hasil tidak bergantung kapan test dijalankan.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
