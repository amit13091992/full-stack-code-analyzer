#!/usr/bin/env node
// One-off script (NOT part of `npm test` / CI) that produces real usage numbers from the
// mocked Anthropic pipeline, for the README's "measured cost savings" section.
//
// It exercises the actual production code path — ContextBuilder.buildContextBlock building
// the real, byte-identical leading context block for a fixture manifest, then
// createDefaultMockClient() (the same mock the app wires up when LLM_MOCK=1, and the one every
// integration/E2E test runs against) returning its canned-but-schema-valid responses — then
// feeds the resulting usage objects through the exact same cost formula apps/api/src/db/usage-repo.ts
// uses, so the numbers in the README are derived, not hand-typed.
//
// Run (after building apps/api once):
//   npm run build --workspace=apps/api
//   node scripts/measure-cache-savings.mjs
import { buildContextBlock } from '../apps/api/dist/lib/context-builder.js';
import { createDefaultMockClient } from '../apps/api/dist/lib/anthropic-client.js';

const manifest = {
  codebaseId: 'sample-repo',
  createdAt: new Date().toISOString(),
  sourceType: 'zip',
  sourceRef: 'sample-repo.zip',
  totalFiles: 42,
  totalBytes: 120_000,
  files: [],
  frameworks: [{ name: 'express', source: 'package.json', version: '4.19.0' }],
  highSignalFiles: ['src/index.ts', 'src/routes/auth.ts', 'src/middleware/session.ts'],
  contentHash: 'fixture-hash-1',
};

const fileContents = new Map([
  ['src/index.ts', 'export const main = () => 1;\nconsole.log("hello");\n'],
  ['src/routes/auth.ts', 'export function login(req, res) { /* ... */ }\n'],
  ['src/middleware/session.ts', 'export function session(req, res, next) { next(); }\n'],
]);

const { text: contextBlockText } = buildContextBlock(manifest, fileContents);

const client = createDefaultMockClient();

const results = [];
for (const q of ['Run a security audit of the auth flow', 'Find N+1 query patterns']) {
  const r = await client.query({
    codebaseId: manifest.codebaseId,
    contextBlockText,
    userQuery: q,
    outputSchema: 'FindingsResponse',
  });
  results.push({ query: q, usage: r.usage });
}

console.log('--- Per-query usage (real objects from the mock client, same shape as the real API) ---');
console.log(JSON.stringify(results, null, 2));

// Same pricing table + formula as apps/api/src/db/usage-repo.ts — published, illustrative
// Claude pricing, used only for the computed counterfactual and actual-cost estimate.
const PRICE_PER_MTOK_USD = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };
function costUsd(u) {
  return (
    (u.input_tokens / 1e6) * PRICE_PER_MTOK_USD.input +
    (u.output_tokens / 1e6) * PRICE_PER_MTOK_USD.output +
    (u.cache_creation_input_tokens / 1e6) * PRICE_PER_MTOK_USD.cacheWrite +
    (u.cache_read_input_tokens / 1e6) * PRICE_PER_MTOK_USD.cacheRead
  );
}
const actualTotal = results.reduce((s, r) => s + costUsd(r.usage), 0);
const assumedInputTokensPerQuery = Math.max(
  0,
  ...results.map((r) => r.usage.cache_creation_input_tokens || r.usage.cache_read_input_tokens),
);
const noCacheTotal =
  ((assumedInputTokensPerQuery * results.length) / 1e6) * PRICE_PER_MTOK_USD.input +
  results.reduce((s, r) => s + (r.usage.output_tokens / 1e6) * PRICE_PER_MTOK_USD.output, 0);

console.log('\n--- Cost summary (isComputedCounterfactual math from apps/api/src/db/usage-repo.ts) ---');
console.log(
  JSON.stringify(
    {
      actualEstimatedCostUsd: actualTotal,
      noCacheBaseline: {
        isComputedCounterfactual: true,
        assumedInputTokensPerQuery,
        queryCount: results.length,
        estimatedCostUsd: noCacheTotal,
      },
      savingsUsd: noCacheTotal - actualTotal,
      savingsPct: ((noCacheTotal - actualTotal) / noCacheTotal) * 100,
    },
    null,
    2,
  ),
);
