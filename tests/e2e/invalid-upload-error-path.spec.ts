import { test, expect } from '@playwright/test';
import path from 'node:path';
const INVALID_ZIP = path.resolve(__dirname, '../fixtures/zips/invalid.zip');

test('uploading an invalid file shows an error state instead of crashing', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (err) => pageErrors.push(err));

  await page.goto('/');
  await page.getByLabel(/zip dropzone/i).locator('input[type="file"]').setInputFiles(INVALID_ZIP);

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: /AI Code Analyzer/i })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
