import type { FieldError } from '@/common/exceptions/error-factories';
import { formatWorkDays, parseWorkDays, timeToMinutes } from '@/common/utils/time.util';

export interface ShiftTiming {
  startTime: string;
  endTime: string;
  checkInOpenMinutes: number;
  workDays: string;
}

/**
 * Aturan lintas-field shift (BUSINESS-RULES §1). Mengembalikan daftar error (kosong = valid)
 * dan `workDays` yang sudah dinormalisasi (terurut).
 */
export function validateShiftTiming(shift: ShiftTiming): {
  errors: FieldError[];
  workDays: string;
} {
  const errors: FieldError[] = [];
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);

  if (end <= start) {
    errors.push({
      field: 'endTime',
      messages: ['Jam pulang harus setelah jam masuk (shift lintas tengah malam tidak didukung)'],
    });
  }
  if (start - shift.checkInOpenMinutes < 0) {
    errors.push({
      field: 'checkInOpenMinutes',
      messages: ['Waktu buka absen tidak boleh dimulai sebelum pukul 00:00'],
    });
  }

  const days = parseWorkDays(shift.workDays);
  if (!days) {
    errors.push({
      field: 'workDays',
      messages: ['Hari kerja harus angka 1–7 yang unik dipisah koma, mis. "1,2,3,4,5"'],
    });
  }

  return { errors, workDays: days ? formatWorkDays(days) : shift.workDays };
}
