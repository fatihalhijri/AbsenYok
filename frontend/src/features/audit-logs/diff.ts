import { ATTENDANCE_STATUS_META } from '@/components/shared/status-badge';
import { formatDateShort, formatDateTime } from '@/lib/date';
import type { AttendanceStatus, AuditAction } from '@/types';

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: 'Login',
  LOGIN_FAILED: 'Login gagal',
  LOGOUT: 'Logout',
  PASSWORD_CHANGED: 'Ganti password',
  USER_CREATED: 'Pengguna dibuat',
  USER_UPDATED: 'Pengguna diubah',
  USER_DEACTIVATED: 'Pengguna dinonaktifkan',
  DEVICE_BOUND: 'Perangkat diikat',
  DEVICE_RESET: 'Perangkat direset',
  ATTENDANCE_CORRECTED: 'Absensi dikoreksi',
  ATTENDANCE_MANUAL_CREATED: 'Absensi manual',
  LEAVE_APPROVED: 'Izin disetujui',
  LEAVE_REJECTED: 'Izin ditolak',
  KIOSK_SECRET_ROTATED: 'Secret kiosk dirotasi',
  SETTING_UPDATED: 'Pengaturan diubah',
  REFRESH_TOKEN_REUSE_DETECTED: 'Token refresh dipakai ulang',
};

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

/** Label field metadata (yang tidak dikenal tampil apa adanya). */
const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  checkInAt: 'Jam masuk',
  checkOutAt: 'Jam pulang',
  checkInMethod: 'Metode masuk',
  checkOutMethod: 'Metode pulang',
  lateMinutes: 'Terlambat (menit)',
  earlyLeaveMinutes: 'Pulang cepat (menit)',
  workMinutes: 'Lama kerja (menit)',
  note: 'Catatan',
  isActive: 'Aktif',
  name: 'Nama',
  email: 'Email',
  phone: 'Telepon',
  position: 'Jabatan',
  role: 'Role',
  employeeCode: 'NIP',
  departmentId: 'ID departemen',
  shiftId: 'ID shift',
  locationId: 'ID lokasi',
  userId: 'ID karyawan',
  date: 'Tanggal',
  type: 'Tipe',
  startDate: 'Mulai',
  endDate: 'Selesai',
  totalDays: 'Jumlah hari kerja',
  convertedAttendances: 'Absensi dikonversi',
  deviceId: 'ID perangkat',
  wasBound: 'Sebelumnya terikat',
  revokedSessions: 'Sesi dicabut',
  softDeleted: 'Dihapus (soft delete)',
  source: 'Sumber',
  familyId: 'ID sesi',
  tokenId: 'ID token',
  value: 'Nilai',
};

/** Kode alasan dari backend (mis. login gagal) → kalimat. */
const REASON_LABELS: Record<string, string> = {
  UNKNOWN_EMAIL: 'Email tidak terdaftar',
  INVALID_PASSWORD: 'Password salah',
  ACCOUNT_LOCKED: 'Akun sedang dikunci',
  ACCOUNT_INACTIVE: 'Akun nonaktif',
};

const METHOD_LABELS: Record<string, string> = {
  KIOSK_QR: 'QR kiosk',
  PERSONAL_QR: 'QR personal',
  MANUAL: 'Manual',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  SICK: 'Sakit',
  PERMIT: 'Izin',
  ANNUAL: 'Cuti tahunan',
};

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

/** Nilai metadata → teks yang mudah dibaca (waktu di zona aplikasi, enum → label). */
export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'number') return value.toLocaleString('id-ID');
  if (typeof value === 'string') {
    if (key === 'status' && value in ATTENDANCE_STATUS_META) {
      return ATTENDANCE_STATUS_META[value as AttendanceStatus].label;
    }
    if (key.endsWith('Method')) return METHOD_LABELS[value] ?? value;
    if (key === 'type') return LEAVE_TYPE_LABELS[value] ?? value;
    if (ISO_DATETIME.test(value) && !Number.isNaN(Date.parse(value))) {
      return formatDateTime(value);
    }
    if (ISO_DATE.test(value)) return formatDateShort(value);
    return value;
  }
  return JSON.stringify(value);
}

export interface DiffRow {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface AuditDetails {
  /** Perbandingan sebelum/sesudah (kosong bila metadata tidak memuat before/after). */
  diff: DiffRow[];
  /** Ada `before` (koreksi/ubah) — `false` untuk data baru (hanya `after`). */
  hasBefore: boolean;
  /** Informasi lain di metadata (mis. tanggal, jumlah sesi dicabut). */
  info: { key: string; label: string; value: string }[];
  reason: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Uraikan `metadata` audit menjadi diff before/after yang mudah dibaca. Mendukung objek
 * (`{ before: {...}, after: {...} }`), nilai tunggal (pengaturan: `{ before: 30, after: 45 }`),
 * dan metadata tanpa diff (ditampilkan sebagai daftar info).
 */
export function auditDetails(metadata: unknown): AuditDetails {
  const data = isRecord(metadata) ? metadata : {};
  const { before, after, reason, ...rest } = data;
  const hasDiff = 'before' in data || 'after' in data;

  let diff: DiffRow[] = [];
  if (hasDiff) {
    if (isRecord(before) || isRecord(after)) {
      const left = isRecord(before) ? before : {};
      const right = isRecord(after) ? after : {};
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
      diff = keys.map((key) => {
        const changed = JSON.stringify(left[key] ?? null) !== JSON.stringify(right[key] ?? null);
        return {
          key,
          label: fieldLabel(key),
          before: isRecord(before) ? formatAuditValue(key, left[key]) : '—',
          after: formatAuditValue(key, right[key]),
          changed,
        };
      });
      // Field yang berubah tampil lebih dulu.
      diff.sort((a, b) => Number(b.changed) - Number(a.changed));
    } else {
      diff = [
        {
          key: 'value',
          label: fieldLabel('value'),
          before: formatAuditValue('value', before),
          after: formatAuditValue('value', after),
          changed: JSON.stringify(before ?? null) !== JSON.stringify(after ?? null),
        },
      ];
    }
  }

  return {
    diff,
    hasBefore: before !== undefined && before !== null,
    info: Object.entries(rest).map(([key, value]) => ({
      key,
      label: fieldLabel(key),
      value: formatAuditValue(key, value),
    })),
    reason: typeof reason === 'string' && reason ? (REASON_LABELS[reason] ?? reason) : null,
  };
}
