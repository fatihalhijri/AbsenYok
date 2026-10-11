import type { Env } from '@/config/env.schema';

/** Pembaca env bertipe (dipenuhi oleh AppConfigService). */
export interface EnvReader {
  get<K extends keyof Env>(key: K): Env[K];
}

type SettingType = 'string' | 'boolean' | 'number';
type TypeOf<T extends SettingType> = T extends 'boolean'
  ? boolean
  : T extends 'number'
    ? number
    : string;

interface SettingDefinition<T extends SettingType> {
  type: T;
  /** Nilai bawaan bila belum ada di tabel `settings` (env = default awal). */
  fallback: (env: EnvReader) => TypeOf<T>;
}

const define = <T extends SettingType>(type: T, fallback: (env: EnvReader) => TypeOf<T>) =>
  ({ type, fallback }) as SettingDefinition<T>;

/**
 * Whitelist key `settings` (docs/DATABASE.md). Nilai di tabel menimpa env.
 * Menambah key baru: tambahkan di sini + di UpdateSettingsDto.
 */
export const SETTING_DEFINITIONS = {
  'company.name': define('string', (env) => env.get('APP_NAME')),
  'company.logoUrl': define('string', () => ''),
  'attendance.geofenceEnabled': define('boolean', (env) => env.get('GEOFENCE_ENABLED')),
  'attendance.deviceBindingEnabled': define('boolean', (env) => env.get('DEVICE_BINDING_ENABLED')),
  'attendance.minCheckoutGapMinutes': define('number', (env) =>
    env.get('MIN_CHECKOUT_GAP_MINUTES'),
  ),
  'leave.annualQuota': define('number', () => 12),
  'leave.maxRangeDays': define('number', () => 14),
};

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export type SettingValues = {
  [K in SettingKey]: (typeof SETTING_DEFINITIONS)[K] extends SettingDefinition<infer T>
    ? TypeOf<T>
    : never;
};

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

/** Nilai tersimpan (string) → tipe sesuai definisi; `undefined` bila tidak bisa diurai. */
export function parseSettingValue(
  type: SettingType,
  raw: string,
): string | number | boolean | undefined {
  switch (type) {
    case 'boolean':
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return undefined;
    case 'number': {
      const value = Number(raw);
      return raw.trim() !== '' && Number.isFinite(value) ? value : undefined;
    }
    default:
      return raw;
  }
}
