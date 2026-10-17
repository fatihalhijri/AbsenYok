import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

export const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1').replace(
  /\/+$/,
  '',
);
// Playwright dijalankan dari folder frontend (lokasi playwright.config.ts).
export const DATA_FILE = join(process.cwd(), 'e2e', '.data', 'setup.json');

/** Data yang dibuat global setup (satu karyawan uji per run). */
export interface E2EData {
  runId: string;
  superAdmin: { email: string; password: string };
  employee: { id: string; name: string; code: string; email: string; password: string };
  location: { id: string; latitude: number; longitude: number };
  kioskId: string;
  leaveId: string;
}

export const readData = (): E2EData => JSON.parse(readFileSync(DATA_FILE, 'utf8')) as E2EData;

/**
 * IP klien acak per sesi: endpoint login dibatasi per IP (backend percaya `X-Forwarded-For` dari
 * proxy) — tanpa ini run berulang bisa terkena 429.
 */
export const randomClientIp = () =>
  `198.18.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

/** Panggilan API langsung ke backend (setup/verifikasi), format respons `{ success, data }`. */
export async function api<T>(
  method: string,
  path: string,
  { token, body, form }: { token?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'X-Forwarded-For': randomClientIp() };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const json = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code: string; message: string };
  } | null;
  if (!response.ok) {
    throw new Error(
      `${method} ${path} → ${response.status} ${json?.error?.code ?? ''} ${json?.error?.message ?? ''}`,
    );
  }
  return json?.data as T;
}

export const loginApi = async (email: string, password: string) =>
  (await api<{ accessToken: string }>('POST', '/auth/login', { body: { email, password } }))
    .accessToken;

/** Login lewat UI lalu tunggu sampai diarahkan ke `expectedPath`. */
export async function loginUi(page: Page, email: string, password: string, next?: string) {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': randomClientIp() });
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /^Masuk/ }).click();
}

/**
 * Kamera tiruan: `getUserMedia` → stream dari canvas yang menggambar `window.__qr` (data URL).
 * Dipasang sebelum skrip halaman berjalan (`page.addInitScript`).
 */
export const FAKE_CAMERA = () => {
  const w = window as unknown as { __qr: string | null };
  w.__qr = null;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const image = new Image();
  let current: string | null = null;
  const draw = () => {
    ctx.fillStyle = '#556';
    ctx.fillRect(0, 0, 640, 640);
    if (w.__qr !== current) {
      current = w.__qr;
      if (current) image.src = current;
    }
    if (current && image.complete && image.naturalWidth) ctx.drawImage(image, 80, 80, 480, 480);
    requestAnimationFrame(draw);
  };
  draw();
  const devices = navigator.mediaDevices;
  devices.getUserMedia = async () => canvas.captureStream(15);
  devices.enumerateDevices = async () =>
    [
      { kind: 'videoinput', deviceId: 'fake-back', label: 'Kamera belakang', groupId: 'g' },
    ] as MediaDeviceInfo[];
};
