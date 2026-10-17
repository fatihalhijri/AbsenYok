import { defineConfig, devices } from '@playwright/test';

/**
 * E2E terhadap frontend + backend yang sudah berjalan dengan DB seed (lihat README → E2E).
 * - `E2E_BASE_URL`  : frontend (default http://localhost:3000)
 * - `E2E_API_URL`   : backend langsung, untuk menyiapkan data uji (default http://localhost:4000/api/v1)
 * - `E2E_CHANNEL`   : browser terpasang (`chrome`/`msedge`); kosong = Chromium bawaan Playwright
 * Gunakan DB khusus uji (mis. `absenyok_test`): global setup membuat shift, karyawan & pengajuan.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Skenario saling bergantung pada data setup yang sama → berurutan, satu worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
  },
  projects: [
    {
      name: 'mobile-karyawan',
      testMatch: /employee-.*\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
      },
    },
    {
      name: 'desktop-admin',
      testMatch: /admin-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } },
    },
  ],
});
