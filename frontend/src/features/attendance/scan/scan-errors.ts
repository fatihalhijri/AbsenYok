import { formatTime } from '@/lib/date';

/** Aksi pada layar hasil gagal. */
export type ScanErrorAction =
  /** Tutup hasil & lanjutkan kamera. */
  | 'scan-again'
  /** Ambil ulang lokasi lalu lanjutkan kamera. */
  | 'refresh-location'
  | 'history'
  /** Ke beranda (label "Kembali"). */
  | 'home';

export interface ScanErrorView {
  title: string;
  message: string;
  /** Saran tindak lanjut (opsional). */
  hint?: string;
  /** Fakta pendukung, mis. jarak & radius. */
  facts: { label: string; value: string }[];
  /** Urutan = prioritas; yang pertama jadi tombol utama. */
  actions: ScanErrorAction[];
}

export const ACTION_LABELS: Record<ScanErrorAction, string> = {
  'scan-again': 'Scan Ulang',
  'refresh-location': 'Perbarui lokasi',
  history: 'Lihat Riwayat',
  home: 'Kembali',
};

type Details = Record<string, unknown>;

const asDetails = (details: unknown): Details =>
  typeof details === 'object' && details !== null && !Array.isArray(details)
    ? (details as Details)
    : {};

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const time = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? formatTime(value) : null;

const meters = (value: number) => `${Math.round(value).toLocaleString('id-ID')} m`;

/**
 * Judul, pesan ramah, fakta & aksi spesifik untuk tiap `error.code` dari `POST /attendance/scan`
 * (lihat tabel di prompt FE-05 & docs/API-CONTRACT.md). Kode `GEO_*` berasal dari Geolocation
 * di perangkat (belum sampai server).
 */
export function describeScanError(code: string, message: string, details?: unknown): ScanErrorView {
  const d = asDetails(details);
  const base = { message, facts: [] as ScanErrorView['facts'] };

  switch (code) {
    case 'QR_EXPIRED':
      return {
        ...base,
        title: 'QR sudah kedaluwarsa',
        hint: 'QR di kiosk berganti tiap 30 detik. Arahkan kamera ke QR yang sedang tampil.',
        actions: ['scan-again', 'home'],
      };
    case 'QR_INVALID':
      return {
        ...base,
        title: 'QR tidak dikenali',
        hint: 'Pastikan Anda memindai QR yang tampil di layar kiosk kantor.',
        actions: ['scan-again', 'home'],
      };
    case 'OUTSIDE_GEOFENCE': {
      const distance = num(d.distance);
      const radius = num(d.radius);
      return {
        ...base,
        title: 'Anda di luar area kantor',
        hint: 'Pastikan Anda berada di area kantor, lalu scan ulang.',
        facts: [
          ...(distance !== null ? [{ label: 'Jarak Anda', value: meters(distance) }] : []),
          ...(radius !== null ? [{ label: 'Radius kantor', value: meters(radius) }] : []),
        ],
        actions: ['refresh-location', 'home'],
      };
    }
    case 'LOCATION_ACCURACY_LOW': {
      const accuracy = num(d.accuracy);
      const max = num(d.maxAccuracy);
      return {
        ...base,
        title: 'Sinyal GPS lemah',
        hint: 'Pindah ke dekat jendela/area terbuka, tunggu sebentar, lalu perbarui lokasi.',
        facts: [
          ...(accuracy !== null ? [{ label: 'Akurasi', value: `±${meters(accuracy)}` }] : []),
          ...(max !== null ? [{ label: 'Batas maksimal', value: meters(max) }] : []),
        ],
        actions: ['refresh-location', 'home'],
      };
    }
    case 'DEVICE_MISMATCH':
      return {
        ...base,
        title: 'Perangkat tidak terdaftar',
        hint: 'Akun Anda terikat ke HP lain. Hubungi admin untuk reset perangkat.',
        actions: ['home'],
      };
    case 'ALREADY_CHECKED_OUT':
      return {
        ...base,
        title: 'Sudah absen pulang',
        facts: time(d.checkOutAt) ? [{ label: 'Pulang pukul', value: time(d.checkOutAt)! }] : [],
        actions: ['history', 'home'],
      };
    case 'ALREADY_CHECKED_IN':
      return { ...base, title: 'Sudah absen masuk', actions: ['history', 'home'] };
    case 'CHECKIN_WINDOW_CLOSED': {
      const opensAt = time(d.opensAt);
      const closedAt = time(d.closedAt);
      return {
        ...base,
        title: opensAt ? 'Absen masuk belum dibuka' : 'Jam absen masuk sudah lewat',
        hint: opensAt
          ? `Silakan scan kembali mulai pukul ${opensAt}.`
          : 'Bila ada kendala, ajukan izin atau hubungi admin.',
        facts: opensAt
          ? [{ label: 'Dibuka pukul', value: opensAt }]
          : closedAt
            ? [{ label: 'Ditutup pukul', value: closedAt }]
            : [],
        actions: ['home'],
      };
    }
    case 'CHECKOUT_TOO_SOON': {
      const availableAt = time(d.availableAt);
      return {
        ...base,
        title: 'Belum bisa absen pulang',
        facts: availableAt ? [{ label: 'Tersedia pukul', value: availableAt }] : [],
        actions: ['home'],
      };
    }
    case 'TOO_MANY_REQUESTS': {
      const retry = num(d.retryAfterSeconds);
      return {
        ...base,
        title: 'Terlalu banyak percobaan',
        hint:
          retry !== null ? `Coba lagi dalam ${retry} detik.` : 'Tunggu sebentar lalu coba lagi.',
        actions: ['home'],
      };
    }
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return {
        ...base,
        title: 'Koneksi bermasalah',
        hint: 'Periksa koneksi internet. Bila absen ternyata sudah tercatat, cek di beranda.',
        actions: ['scan-again', 'home'],
      };
    case 'GEO_PERMISSION_DENIED':
    case 'GEO_POSITION_UNAVAILABLE':
    case 'GEO_TIMEOUT':
    case 'GEO_UNSUPPORTED':
      return {
        ...base,
        title: 'Lokasi belum didapat',
        hint: 'Absensi membutuhkan lokasi Anda untuk memastikan Anda berada di kantor.',
        actions: code === 'GEO_UNSUPPORTED' ? ['home'] : ['refresh-location', 'home'],
      };
    case 'KIOSK_INACTIVE':
      return { ...base, title: 'Kiosk tidak aktif', actions: ['home'] };
    case 'QR_ALREADY_USED':
      return { ...base, title: 'QR sudah dipakai', actions: ['scan-again', 'home'] };
    case 'NO_SHIFT_ASSIGNED':
      return { ...base, title: 'Belum ada jadwal shift', actions: ['home'] };
    case 'NOT_WORKING_DAY':
      return { ...base, title: 'Bukan hari kerja', actions: ['home'] };
    case 'HOLIDAY':
      return { ...base, title: 'Hari ini libur', actions: ['home'] };
    case 'ON_LEAVE':
      return { ...base, title: 'Anda sedang izin/cuti', actions: ['home'] };
    case 'ACCOUNT_INACTIVE':
      return { ...base, title: 'Akun dinonaktifkan', actions: ['home'] };
    default:
      return { ...base, title: 'Absen gagal', actions: ['home'] };
  }
}

/** Prefix token QR kiosk (docs/QR-SECURITY.md §A). */
export const KIOSK_QR_PREFIX = 'AY1.K.';

/** Validasi cepat di klien: hanya QR kiosk AbsenYok yang dikirim ke server. */
export function isKioskQr(value: string): boolean {
  return value.startsWith(KIOSK_QR_PREFIX) && value.split('.').length === 5;
}

/** Pesan penolakan QR non-kiosk (toast). */
export function rejectMessage(value: string): string {
  return value.startsWith('AY1.P.')
    ? 'Ini QR personal. Pindai QR yang tampil di layar kiosk kantor.'
    : 'Ini bukan QR absensi AbsenYok';
}

/** Prefix token QR personal karyawan (docs/QR-SECURITY.md §B) — dipindai petugas (FE-09). */
export const PERSONAL_QR_PREFIX = 'AY1.P.';

/** Validasi cepat di klien untuk scan petugas: hanya QR personal yang dikirim ke server. */
export function isPersonalQr(value: string): boolean {
  return value.startsWith(PERSONAL_QR_PREFIX) && value.split('.').length === 5;
}

/** Pesan penolakan QR non-personal pada pemindai petugas (toast). */
export function rejectPersonalMessage(value: string): string {
  return value.startsWith(KIOSK_QR_PREFIX)
    ? 'Ini QR kiosk. Minta karyawan membuka menu QR Saya di aplikasinya.'
    : 'Ini bukan QR personal AbsenYok';
}
