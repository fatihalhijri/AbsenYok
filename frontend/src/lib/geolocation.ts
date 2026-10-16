/** Posisi ringkas yang dikirim ke backend. */
export interface Position {
  latitude: number;
  longitude: number;
  /** Radius akurasi (meter). */
  accuracy: number;
  /** Epoch ms saat posisi diambil. */
  timestamp: number;
}

export type GeoErrorCode = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';

const MESSAGES: Record<GeoErrorCode, string> = {
  PERMISSION_DENIED: 'Izin lokasi ditolak. Aktifkan izin lokasi untuk aplikasi ini lalu coba lagi.',
  POSITION_UNAVAILABLE:
    'Lokasi tidak dapat ditentukan. Pastikan GPS/Layanan Lokasi aktif dan coba di area terbuka.',
  TIMEOUT: 'Pengambilan lokasi terlalu lama. Pindah ke dekat jendela/area terbuka lalu coba lagi.',
  UNSUPPORTED: 'Perangkat atau browser ini tidak mendukung lokasi.',
};

export class GeoError extends Error {
  readonly code: GeoErrorCode;
  constructor(code: GeoErrorCode) {
    super(MESSAGES[code]);
    this.name = 'GeoError';
    this.code = code;
  }
}

/** Ubah `GeolocationPositionError` (kode 1/2/3) menjadi `GeoError` berpesan Indonesia. */
export function toGeoError(error: { code: number }): GeoError {
  switch (error.code) {
    case 1:
      return new GeoError('PERMISSION_DENIED');
    case 3:
      return new GeoError('TIMEOUT');
    default:
      return new GeoError('POSITION_UNAVAILABLE');
  }
}

export const DEFAULT_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
};

const toPosition = ({ coords, timestamp }: GeolocationPosition): Position => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
  accuracy: coords.accuracy,
  timestamp,
});

const supported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/** Satu kali ambil posisi (Promise). */
export function getCurrentPosition(options: PositionOptions = DEFAULT_GEO_OPTIONS) {
  return new Promise<Position>((resolve, reject) => {
    if (!supported()) {
      reject(new GeoError('UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toPosition(position)),
      (error) => reject(toGeoError(error)),
      options,
    );
  });
}

/** Pantau posisi terus-menerus; kembalikan fungsi untuk berhenti. */
export function watchPosition(
  onPosition: (position: Position) => void,
  onError: (error: GeoError) => void,
  options: PositionOptions = DEFAULT_GEO_OPTIONS,
): () => void {
  if (!supported()) {
    onError(new GeoError('UNSUPPORTED'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (position) => onPosition(toPosition(position)),
    (error) => onError(toGeoError(error)),
    options,
  );
  return () => navigator.geolocation.clearWatch(id);
}
