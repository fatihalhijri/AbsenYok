import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';

export type DeviceBindingResult = 'SKIPPED' | 'MATCHED' | 'BIND';

/**
 * BUSINESS-RULES §7 langkah 4 (1 akun = 1 HP).
 * Hasil `BIND` berarti perangkat ini akan diikat — penyimpanan dilakukan di transaksi
 * scan yang berhasil (agar HP lain yang gagal scan, mis. dari luar kantor, tidak ikut terikat).
 */
@Injectable()
export class DeviceBindingService {
  assertOrBind(
    user: { boundDeviceId: string | null },
    deviceId: string,
    enabled: boolean,
  ): DeviceBindingResult {
    if (!enabled) return 'SKIPPED';
    if (user.boundDeviceId === null) return 'BIND';
    if (user.boundDeviceId.toLowerCase() === deviceId.toLowerCase()) return 'MATCHED';
    throw new BusinessException(ErrorCode.DEVICE_MISMATCH);
  }
}
