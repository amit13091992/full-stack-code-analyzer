import { test, expect } from '@playwright/test';

// Trivial scaffold-only E2E spec confirming the Playwright pipeline itself works.
// Full app E2E flows (upload -> query -> findings) are scoped to M4, not this milestone.
test('playwright pipeline is wired up', async () => {
  expect(1 + 1).toBe(2);
});
