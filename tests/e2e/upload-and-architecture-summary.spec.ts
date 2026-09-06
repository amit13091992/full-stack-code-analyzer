import { test, expect } from '@playwright/test';
import path from 'node:path';
const SAMPLE_ZIP = path.resolve(__dirname, '../fixtures/zips/sample-repo.zip');

test('uploading a fixture ZIP renders the architecture summary', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel(/zip dropzone/i).locator('input[type="file"]').setInputFiles(SAMPLE_ZIP);

  const summary = page.getByLabel('Architecture summary');
  await expect(summary).toBeVisible();
  await expect(summary.getByText(/express/i)).toBeVisible();
  await expect(summary.getByText('src/routes/auth.ts').first()).toBeVisible();
});
