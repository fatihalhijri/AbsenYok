import { expect, test } from '@playwright/test';
import { api, loginApi, loginUi, readData } from './support';

test('admin: setujui pengajuan izin → status berubah', async ({ page }) => {
  const data = readData();
  await loginUi(page, data.superAdmin.email, data.superAdmin.password);
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto(`/admin/leave-requests?search=${encodeURIComponent(data.employee.code)}`);
  const card = page.getByTestId('admin-leave-card').filter({ hasText: data.employee.name });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('data-status', 'PENDING');

  await card.getByRole('button', { name: 'Setujui' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#review-note').fill('Disetujui lewat uji E2E');
  await dialog.getByRole('button', { name: 'Setujui' }).click();

  await expect(page.getByText('Pengajuan disetujui')).toBeVisible();
  // Tab "Menunggu": kartu hilang (optimistic + sinkron server).
  await expect(card).toHaveCount(0);

  await page.getByRole('tab', { name: 'Disetujui' }).click();
  const approved = page.getByTestId('admin-leave-card').filter({ hasText: data.employee.name });
  await expect(approved).toHaveAttribute('data-status', 'APPROVED');
  await expect(approved).toContainText('Disetujui lewat uji E2E');

  const token = await loginApi(data.superAdmin.email, data.superAdmin.password);
  const leave = await api<{ status: string }>('GET', `/leave-requests/${data.leaveId}`, { token });
  expect(leave.status).toBe('APPROVED');
});
