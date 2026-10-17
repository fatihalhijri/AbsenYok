import { statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { loginUi, readData } from './support';

test('admin: export rekap bulanan → file Excel & PDF terunduh dengan nama dari server', async ({
  page,
}) => {
  const data = readData();
  await loginUi(page, data.superAdmin.email, data.superAdmin.password);
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/reports');
  await expect(page.getByTestId('monthly-report-table')).toBeVisible();

  for (const [label, extension] of [
    ['Export Excel', 'xlsx'],
    ['Export PDF', 'pdf'],
  ] as const) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: label }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^rekap-absensi-\\d{4}-\\d{2}\\.${extension}$`),
    );
    const path = await download.path();
    expect(statSync(path).size).toBeGreaterThan(1_000);
    await expect(page.getByText(download.suggestedFilename())).toBeVisible();
  }
});
