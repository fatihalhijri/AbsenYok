import { expect, test } from '@playwright/test';
import QRCode from 'qrcode';
import { api, FAKE_CAMERA, loginApi, loginUi, readData } from './support';

test('karyawan: login → beranda → scan QR kiosk → absen masuk sukses', async ({
  page,
  context,
}) => {
  const data = readData();
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    latitude: data.location.latitude,
    longitude: data.location.longitude,
    accuracy: 10,
  });
  await page.addInitScript(FAKE_CAMERA);

  await loginUi(page, data.employee.email, data.employee.password);
  await expect(page).toHaveURL(/\/app$/);
  const card = page.getByRole('region', { name: 'Status absensi hari ini' });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: /Scan Absen Masuk/ }).click();

  await expect(page).toHaveURL(/\/app\/scan$/);
  await expect(page.locator('video')).toBeVisible();

  // Token kiosk terbaru (berganti tiap 30 dtk) dari backend → ditampilkan ke kamera tiruan.
  const adminToken = await loginApi(data.superAdmin.email, data.superAdmin.password);
  const { token } = await api<{ token: string }>('GET', `/kiosks/${data.kioskId}/qr`, {
    token: adminToken,
  });
  const qr = await QRCode.toDataURL(token, { width: 480, margin: 4 });
  await page.evaluate((url) => {
    (window as unknown as { __qr: string }).__qr = url;
  }, qr);

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Absen Masuk Berhasil' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(dialog.locator('[data-outcome="success"]')).toBeVisible();

  await expect(dialog.getByText('Hadir', { exact: true })).toBeVisible();

  // Kembali ke beranda → kartu "Sedang bekerja" (absen pulang baru tersedia setelah jeda minimal).
  await dialog.getByRole('button', { name: 'Kembali ke Beranda' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(card.getByRole('heading', { name: 'Sedang bekerja' })).toBeVisible();
  await expect(card).toContainText('Absen pulang tersedia pukul');
});
