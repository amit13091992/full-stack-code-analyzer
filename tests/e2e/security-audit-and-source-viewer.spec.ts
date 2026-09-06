import { test, expect } from '@playwright/test';
import path from 'node:path';
const SAMPLE_ZIP = path.resolve(__dirname, '../fixtures/zips/sample-repo.zip');

test('running the Security audit template renders findings, and a click opens the source viewer + diff', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel(/zip dropzone/i).locator('input[type="file"]').setInputFiles(SAMPLE_ZIP);
  await expect(page.getByLabel('Architecture summary')).toBeVisible();

  await page.getByRole('button', { name: 'Security audit' }).click();
  await page.getByRole('button', { name: /run query/i }).click();

  const findings = page.getByLabel('Findings');
  await expect(findings).toBeVisible();
  const firstCard = page.getByTestId('finding-card').first();
  await expect(firstCard).toBeVisible();

  await firstCard.getByRole('button', { name: /src\/index\.ts:\d+-\d+/ }).click();

  const sourceViewer = page.getByLabel('Source viewer');
  await expect(sourceViewer).toBeVisible();
  await expect(sourceViewer.getByText('src/index.ts')).toBeVisible();

  const snippetToggle = firstCard.getByRole('button', { name: /show code snippet/i });
  await snippetToggle.click();
  await expect(firstCard.getByText(/console\.log/)).toBeVisible();

  await firstCard.getByRole('button', { name: /show suggested fix/i }).click();
  const diffView = firstCard.getByTestId('diff-view');
  await expect(diffView).toBeVisible();
  await expect(diffView).toContainText('export const main');
});
