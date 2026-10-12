import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Format token QR (docs/QR-SECURITY.md):
 *   AY1.<type>.<subjectId>.<window>.<signature>
 * - type: `K` (kiosk) atau `P` (personal)
 * - window: floor(unixSeconds / intervalSeconds)
 * - signature: base64url(HMAC-SHA256(secret, "AY1.<type>.<subjectId>.<window>")) — 22 karakter pertama
 */
export const QR_VERSION = 'AY1';
export const QR_SIGNATURE_LENGTH = 22;
export const QR_MAX_LENGTH = 200;

export type QrTokenType = 'K' | 'P';

export interface ParsedQrToken {
  type: QrTokenType;
  subjectId: string;
  window: number;
  signature: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOW_PATTERN = /^\d{1,12}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** Window waktu saat ini untuk interval tertentu. */
export function currentWindow(now: Date, intervalSeconds: number): number {
  return Math.floor(now.getTime() / 1000 / intervalSeconds);
}

/** Akhir window (saat QR harus berganti). */
export function windowEndsAt(window: number, intervalSeconds: number): Date {
  return new Date((window + 1) * intervalSeconds * 1000);
}

function payloadOf(type: QrTokenType, subjectId: string, window: number): string {
  return `${QR_VERSION}.${type}.${subjectId}.${window}`;
}

export function signQrPayload(
  secret: string,
  type: QrTokenType,
  subjectId: string,
  window: number,
): string {
  return createHmac('sha256', secret)
    .update(payloadOf(type, subjectId, window))
    .digest('base64url')
    .slice(0, QR_SIGNATURE_LENGTH);
}

export function buildQrToken(
  secret: string,
  type: QrTokenType,
  subjectId: string,
  window: number,
): string {
  return `${payloadOf(type, subjectId, window)}.${signQrPayload(secret, type, subjectId, window)}`;
}

/**
 * Parser defensif: input apa pun (bukan string, kosong, URL, sangat panjang, karakter aneh)
 * menghasilkan `null` — tidak pernah melempar error.
 */
export function parseQrToken(input: unknown, expectedType: QrTokenType): ParsedQrToken | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > QR_MAX_LENGTH) return null;

  const parts = input.trim().split('.');
  if (parts.length !== 5) return null;

  const [version, type, subjectId, windowRaw, signature] = parts;
  if (version !== QR_VERSION || type !== expectedType) return null;
  if (!UUID_PATTERN.test(subjectId)) return null;
  if (!WINDOW_PATTERN.test(windowRaw) || !SIGNATURE_PATTERN.test(signature)) return null;

  const window = Number(windowRaw);
  if (!Number.isSafeInteger(window)) return null;

  return { type: expectedType, subjectId: subjectId.toLowerCase(), window, signature };
}

/** Bandingkan signature dengan waktu konstan (panjang disamakan lebih dulu). */
export function isSignatureValid(secret: string, token: ParsedQrToken): boolean {
  const expected = Buffer.from(signQrPayload(secret, token.type, token.subjectId, token.window));
  const actual = Buffer.from(token.signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Window diterima: saat ini atau satu sebelumnya (toleransi jeda jaringan/jam). */
export function isWindowAccepted(window: number, current: number): boolean {
  return window === current || window === current - 1;
}
