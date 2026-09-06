import type { CodebaseManifest, FindingsResponse, UsageRecord } from '@code-analyzer/shared';

export const fixtureManifest: CodebaseManifest = {
  codebaseId: 'cb_fixture01',
  createdAt: '2026-01-01T00:00:00.000Z',
  sourceType: 'zip',
  sourceRef: 'fixture.zip',
  totalFiles: 3,
  totalBytes: 300,
  files: [
    { path: 'package.json', language: 'json', lineCount: 5, sizeBytes: 80, isHighSignal: true },
    {
      path: 'src/index.ts',
      language: 'typescript',
      lineCount: 10,
      sizeBytes: 120,
      isHighSignal: true,
    },
    {
      path: 'src/routes/auth.ts',
      language: 'typescript',
      lineCount: 20,
      sizeBytes: 100,
      isHighSignal: true,
    },
  ],
  frameworks: [{ name: 'express', source: 'package.json', version: '4.0.0' }],
  highSignalFiles: ['package.json', 'src/index.ts', 'src/routes/auth.ts'],
  contentHash: 'abc123',
};

export const fixtureFindingsResponse: FindingsResponse = {
  summary: 'Found 2 issues across the codebase.',
  findings: [
    {
      id: 'finding-1',
      title: 'Hardcoded secret in auth handler',
      category: 'security',
      severity: 'critical',
      explanation: 'The API key is hardcoded rather than loaded from environment variables.',
      file_path: 'src/routes/auth.ts',
      line_start: 4,
      line_end: 6,
      code_snippet: 'const apiKey = "sk-12345";\nfunction login() {\n  return apiKey;\n}',
      suggested_fix: {
        description: 'Load the API key from an environment variable instead.',
        diff: `--- a/src/routes/auth.ts
+++ b/src/routes/auth.ts
@@ -1,6 +1,6 @@
-const apiKey = "sk-12345";
+const apiKey = process.env.API_KEY;
 function login() {
   return apiKey;
 }
`,
      },
    },
    {
      id: 'finding-2',
      title: 'Missing null check on user input',
      category: 'types',
      severity: 'low',
      explanation: 'The function does not check if `user` is undefined before accessing it.',
      file_path: 'src/index.ts',
      line_start: 1,
      line_end: 2,
      code_snippet: 'function greet(user) {\n  return `Hello ${user.name}`;\n}',
    },
  ],
};

export const fixtureUsageRecords: UsageRecord = {
  codebaseId: 'cb_fixture01',
  queries: [
    {
      id: 'q_1',
      codebaseId: 'cb_fixture01',
      createdAt: '2026-01-01T00:00:00.000Z',
      template: 'security-audit',
      usage: {
        input_tokens: 500,
        output_tokens: 200,
        cache_creation_input_tokens: 5000,
        cache_read_input_tokens: 0,
      },
    },
    {
      id: 'q_2',
      codebaseId: 'cb_fixture01',
      createdAt: '2026-01-01T00:05:00.000Z',
      template: 'n-plus-one-performance',
      usage: {
        input_tokens: 500,
        output_tokens: 200,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 5000,
      },
    },
  ],
  totals: {
    input_tokens: 1000,
    output_tokens: 400,
    cache_creation_input_tokens: 5000,
    cache_read_input_tokens: 5000,
  },
  actualEstimatedCostUsd: 0.0075,
  noCacheBaseline: {
    isComputedCounterfactual: true,
    assumedInputTokensPerQuery: 5000,
    queryCount: 2,
    estimatedCostUsd: 0.0312,
  },
};

export const fixtureSourceExcerpt = {
  path: 'src/routes/auth.ts',
  content: [
    'import { config } from "../config.js";',
    '',
    'const apiKey = "sk-12345";',
    'function login() {',
    '  return apiKey;',
    '}',
    '',
    'export { login };',
  ].join('\n'),
};
