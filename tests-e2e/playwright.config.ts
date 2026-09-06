import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const API_PORT = 3901;
const WEB_PORT = 4173;

export default defineConfig({
  testDir: '../tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
  },
  webServer: [
    {
      command: 'npm run dev --workspace=apps/api',
      cwd: repoRoot,
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        LLM_MOCK: '1',
        PORT: String(API_PORT),
        DB_PATH: ':memory:',
      },
    },
    {
      command: 'npm run build --workspace=apps/web && npm run preview --workspace=apps/web',
      cwd: repoRoot,
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_BASE: `http://localhost:${API_PORT}/api`,
      },
    },
  ],
});
