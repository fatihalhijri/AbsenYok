import { z } from 'zod';
import { APP_TIMEZONE, DATE_FORMAT, dayjs, formatTime, toDateString } from '@/lib/date';
import type {
  AttendanceDetail,
  AttendanceStatus,
  CorrectAttendanceInput,
  ManualAttendanceInput,
  ShiftSnapshot,
} from '@/types';

/** Status yang wajib punya jam masuk (backend `WORKED_STATUSES`). */
export const WORKED_STATUSES: ReadonlySet<AttendanceStatus> = new Set(['PRESENT', 'LATE']);

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'SICK',
  'PERMIT',
  'LEAVE',
];

/** Pilihan status di form koreksi: `AUTO` = tidak dikirim (backend menghitung ulang). */
export const AUTO_STATUS = 'AUTO';
export type CorrectionStatus = AttendanceStatus | typeof AUTO_STATUS;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTE_MS = 60_000;

/** `('2026-10-22', '08:05')` → instant di zona aplikasi. */
export const combineDateAndTime = (date: string, time: string) =>
  dayjs.tz(`${date} ${time}`, `${DATE_FORMAT} HH:mm`, APP_TIMEZONE);

/** `('2026-10-22', '08:05')` → `2026-10-22T08:05:00+07:00` (ISO 8601 wajib berzona, kontrak API). */
export const toZonedIso = (date: string, time: string) =>
  combineDateAndTime(date, time).format('YYYY-MM-DDTHH:mm:ssZ');

/** Selisih menit dibulatkan menuju nol — sama dengan `dayjs.diff(…, 'minute')` di backend. */
const diffMinutes = (later: Date, earlier: Date) =>
  Math.trunc((later.getTime() - earlier.getTime()) / MINUTE_MS);

const sameInstant = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);

export type TimeField = 'checkIn' | 'checkOut';
export type TimeErrors = Partial<Record<TimeField, string>>;

/**
 * Konsistensi status ↔ jam (backend `assertTimes`): PRESENT/LATE wajib jam masuk, status lain
 * tanpa jam, jam pulang perlu jam masuk & harus setelahnya, dan tidak boleh di masa depan.
 */
export function validateTimes(
  status: AttendanceStatus,
  checkInAt: Date | null,
  checkOutAt: Date | null,
  now: Date,
): TimeErrors {
  const errors: TimeErrors = {};
  if (WORKED_STATUSES.has(status)) {
    if (!checkInAt) errors.checkIn = `Jam masuk wajib untuk status ${STATUS_LABELS[status]}`;
  } else if (checkInAt || checkOutAt) {
    errors[checkInAt ? 'checkIn' : 'checkOut'] =
      `Status ${STATUS_LABELS[status]} tidak boleh memiliki jam masuk/pulang`;
  }
  if (checkOutAt && !checkInAt) errors.checkOut ??= 'Jam pulang memerlukan jam masuk';
  if (checkInAt && checkInAt > now) errors.checkIn ??= 'Waktu tidak boleh di masa depan';
  if (checkOutAt && checkOutAt > now) errors.checkOut ??= 'Waktu tidak boleh di masa depan';
  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
    errors.checkOut ??= 'Jam pulang harus setelah jam masuk';
  }
  return errors;
}

/** Label status (ringkas; dipakai juga di pesan validasi). */
export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Hadir',
  LATE: 'Terlambat',
  ABSENT: 'Alpa',
  SICK: 'Sakit',
  PERMIT: 'Izin',
  LEAVE: 'Cuti',
};

export interface Metrics {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
}

/**
 * Metrik koreksi (backend `computeMetrics`, BUSINESS-RULES §11): PRESENT → keterlambatan
 * dimaafkan (0); LATE → selisih dari jam masuk shift; pulang cepat & lama kerja dari jam pulang.
 */
export function computeMetrics(
  status: AttendanceStatus,
  rule: ShiftSnapshot,
  date: string,
  checkInAt: Date | null,
  checkOutAt: Date | null,
): Metrics {
  if (!WORKED_STATUSES.has(status) || !checkInAt) {
    return { lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 0 };
  }
  const start = combineDateAndTime(date, rule.startTime).toDate();
  const end = combineDateAndTime(date, rule.endTime).toDate();
  const lateBy = Math.max(0, diffMinutes(checkInAt, start));
  return {
    lateMinutes: status === 'LATE' ? lateBy : 0,
    earlyLeaveMinutes: checkOutAt ? Math.max(0, diffMinutes(end, checkOutAt)) : 0,
    workMinutes: checkOutAt ? Math.max(0, diffMinutes(checkOutAt, checkInAt)) : 0,
  };
}

/** Status otomatis dari jam masuk (backend `computeCheckInStatus`, §5). */
export const checkInStatus = (rule: ShiftSnapshot, date: string, checkInAt: Date) =>
  diffMinutes(checkInAt, combineDateAndTime(date, rule.startTime).toDate()) >
  rule.lateToleranceMinutes
    ? 'LATE'
    : 'PRESENT';

export interface CorrectionFormValues {
  /** `HH:mm` atau kosong (= tanpa jam). */
  checkIn: string;
  checkOut: string;
  status: CorrectionStatus;
  note: string;
  reason: string;
}

/** Nilai awal form dari record saat ini (status `AUTO`: ikut hitung ulang). */
export const correctionDefaults = (detail: AttendanceDetail): CorrectionFormValues => ({
  checkIn: detail.checkInAt ? formatTime(detail.checkInAt) : '',
  checkOut: detail.checkOutAt ? formatTime(detail.checkOutAt) : '',
  status: AUTO_STATUS,
  note: detail.note ?? '',
  reason: '',
});

export interface CorrectionPreview {
  /** Field yang benar-benar dikirim (tanpa `reason`); kosong → tidak ada perubahan. */
  payload: Omit<CorrectAttendanceInput, 'reason'>;
  changed: boolean;
  errors: TimeErrors;
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  /** `null` bila record tanpa `shiftSnapshot` (backend memakai shift karyawan saat ini). */
  metrics: Metrics | null;
  /** `false` bila status dihitung server dari shift yang tidak diketahui klien. */
  statusKnown: boolean;
}

/**
 * Preview hasil koreksi sebelum disimpan — meniru `AttendanceAdminService.correct`:
 * jam yang tidak diubah tetap memakai nilai lama (termasuk detiknya); jam masuk berubah tanpa
 * status eksplisit → PRESENT/LATE dihitung ulang dari `shiftSnapshot`.
 */
export function previewCorrection(
  detail: AttendanceDetail,
  values: CorrectionFormValues,
  now: Date,
): CorrectionPreview {
  const current = {
    checkInAt: toDate(detail.checkInAt),
    checkOutAt: toDate(detail.checkOutAt),
  };
  const nextTime = (value: string, previous: Date | null) => {
    const unchanged = previous ? formatTime(previous) === value : value === '';
    if (unchanged) return { changed: false, at: previous };
    return {
      changed: true,
      at: TIME_PATTERN.test(value) ? combineDateAndTime(detail.date, value).toDate() : null,
    };
  };
  const checkIn = nextTime(values.checkIn, current.checkInAt);
  const checkOut = nextTime(values.checkOut, current.checkOutAt);
  const rule = detail.shiftSnapshot ?? null;

  let status: AttendanceStatus =
    values.status === AUTO_STATUS ? (detail.status as AttendanceStatus) : values.status;
  let statusKnown = true;
  if (values.status === AUTO_STATUS && checkIn.changed && checkIn.at) {
    if (rule) status = checkInStatus(rule, detail.date, checkIn.at);
    else statusKnown = false;
  }

  const errors = validateTimes(status, checkIn.at, checkOut.at, now);
  const note = values.note.trim() || null;
  const payload: CorrectionPreview['payload'] = {
    ...(checkIn.changed && {
      checkInAt: checkIn.at ? toZonedIso(detail.date, values.checkIn) : null,
    }),
    ...(checkOut.changed && {
      checkOutAt: checkOut.at ? toZonedIso(detail.date, values.checkOut) : null,
    }),
    ...(values.status !== AUTO_STATUS && values.status !== detail.status && { status }),
    ...(note !== (detail.note ?? null) && { note }),
  };
  // Status eksplisit sama dengan status lama tetap dikirim bila jam masuk berubah (mencegah
  // backend menghitung ulang status yang sengaja dipertahankan admin).
  if (values.status !== AUTO_STATUS && values.status === detail.status && checkIn.changed) {
    payload.status = values.status;
  }

  const metrics = rule ? computeMetrics(status, rule, detail.date, checkIn.at, checkOut.at) : null;
  // Backend menolak koreksi tanpa field (400) maupun yang hasilnya identik ("Tidak ada perubahan").
  const changed =
    Object.keys(payload).length > 0 &&
    (!sameInstant(checkIn.at, current.checkInAt) ||
      !sameInstant(checkOut.at, current.checkOutAt) ||
      status !== detail.status ||
      note !== (detail.note ?? null) ||
      (metrics !== null &&
        (metrics.lateMinutes !== detail.lateMinutes ||
          metrics.earlyLeaveMinutes !== detail.earlyLeaveMinutes ||
          metrics.workMinutes !== detail.workMinutes)));

  return {
    payload,
    changed,
    errors,
    status,
    checkInAt: checkIn.at,
    checkOutAt: checkOut.at,
    metrics,
    statusKnown,
  };
}

const timeField = z
  .string()
  .refine((value) => value === '' || TIME_PATTERN.test(value), { error: 'Format jam HH:mm' });

export const reasonField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} wajib diisi` })
    .min(10, { error: `${label} minimal 10 karakter` })
    .max(255, { error: `${label} maksimal 255 karakter` });

/** Skema form koreksi: alasan wajib (≥ 10 karakter) + konsistensi jam dari preview. */
export function correctionFormSchema(detail: AttendanceDetail, now: () => Date) {
  return z
    .object({
      checkIn: timeField,
      checkOut: timeField,
      status: z.enum([AUTO_STATUS, ...ATTENDANCE_STATUSES]),
      note: z.string().max(255, { error: 'Catatan maksimal 255 karakter' }),
      reason: reasonField('Alasan koreksi'),
    })
    .superRefine((values, ctx) => {
      const preview = previewCorrection(detail, values, now());
      for (const [field, message] of Object.entries(preview.errors)) {
        ctx.addIssue({ code: 'custom', path: [field], message });
      }
      if (!preview.changed) {
        ctx.addIssue({ code: 'custom', path: ['root'], message: 'Tidak ada perubahan data' });
      }
    });
}

export interface ManualFormValues {
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  reason: string;
}

/** Skema absensi manual: tanggal ≤ hari ini, jam sesuai status, alasan wajib. */
export function manualFormSchema(now: () => Date) {
  return z
    .object({
      userId: z.string().min(1, { error: 'Pilih karyawan' }),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Pilih tanggal' }),
      status: z.enum(ATTENDANCE_STATUSES),
      checkIn: timeField,
      checkOut: timeField,
      reason: reasonField('Alasan'),
    })
    .superRefine((values, ctx) => {
      if (values.date > toDateString(now())) {
        ctx.addIssue({
          code: 'custom',
          path: ['date'],
          message: 'Tanggal tidak boleh di masa depan',
        });
        return;
      }
      const at = (time: string) =>
        TIME_PATTERN.test(time) ? combineDateAndTime(values.date, time).toDate() : null;
      const errors = validateTimes(values.status, at(values.checkIn), at(values.checkOut), now());
      for (const [field, message] of Object.entries(errors)) {
        ctx.addIssue({ code: 'custom', path: [field], message });
      }
    });
}

/** Payload `POST /attendance/manual` (jam hanya dikirim bila diisi). */
export const toManualInput = (values: ManualFormValues): ManualAttendanceInput => ({
  userId: values.userId,
  date: values.date,
  status: values.status,
  reason: values.reason.trim(),
  ...(values.checkIn && { checkInAt: toZonedIso(values.date, values.checkIn) }),
  ...(values.checkOut && { checkOutAt: toZonedIso(values.date, values.checkOut) }),
});
