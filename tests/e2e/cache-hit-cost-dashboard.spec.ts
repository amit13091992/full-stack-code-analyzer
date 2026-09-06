import { test, expect } from '@playwright/test';
import path from 'node:path';
const SAMPLE_ZIP = path.resolve(__dirname, '../fixtures/zips/sample-repo.zip');

test('a second query against the same codebase shows nonzero cache-read tokens in the cost dashboard', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel(/zip dropzone/i).locator('input[type="file"]').setInputFiles(SAMPLE_ZIP);
  await expect(page.getByLabel('Architecture summary')).toBeVisible();

  await page.getByRole('button', { name: 'Security audit' }).click();
  await page.getByRole('button', { name: /run query/i }).click();
  await expect(page.getByLabel('Findings')).toBeVisible();

  const costDashboard = page.getByLabel('Cost dashboard');
  await expect(costDashboard).toBeVisible();
  await expect(costDashboard.getByTestId('total-cache-read-tokens')).toHaveText('0');

  await page.getByRole('button', { name: 'N+1 / performance patterns' }).click();
  await page.getByRole('button', { name: /run query/i }).click();

  // The mock's second canned response for this codebase includes a distinct
  // cache_read_input_tokens value (4321) — asserting on it here is the actual
  // cache-hit-on-2nd-query proof for the UI.
  await expect(costDashboard.getByTestId('total-cache-read-tokens')).toHaveText('4321');
  await expect(costDashboard.getByTestId('cache-hit-indicator')).toContainText('Cache hit on 1 of 2 queries.');
});
