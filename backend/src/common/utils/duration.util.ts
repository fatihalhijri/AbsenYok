const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };
const DURATION_PATTERN = /^(\d+)([smhd])$/;

/** `'15m'` → 900, `'7d'` → 604800. Format sama dengan validasi env (`JWT_*_EXPIRES_IN`). */
export function durationToSeconds(duration: string): number {
  const match = DURATION_PATTERN.exec(duration);
  if (!match) {
    throw new RangeError(`Durasi "${duration}" tidak valid (contoh: 15m, 7d)`);
  }
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}
