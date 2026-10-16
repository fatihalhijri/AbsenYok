import { dayjs, DATE_FORMAT } from '@/lib/date';
import type { LeaveType } from '@/types';

/** Batas pengajuan mundur (backend `MAX_BACKDATE_DAYS`). */
export const MAX_BACKDATE_DAYS = 7;
export const MIN_REASON_LENGTH = 10;

/** Tanggal paling awal yang boleh dipilih (hari ini − 7). */
export const earliestStartDate = (today: string) =>
  dayjs(today, DATE_FORMAT).subtract(MAX_BACKDATE_DAYS, 'day').format(DATE_FORMAT);

/** Sakit lebih dari 1 hari kerja wajib surat dokter (BUSINESS-RULES §9). */
export const attachmentRequired = (type: LeaveType | undefined, workingDays: number) =>
  type === 'SICK' && workingDays > 1;
