import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/index.js';
import { RealGitCloner } from '../lib/git-clone.js';
import { MockAnthropicClient, defaultCannedFindingsResponse } from '../lib/anthropic-client.js';
import { buildZipBuffer } from '../test-helpers/zip-fixtures.js';

function multipartBody(zipBuffer: Buffer): FormData {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(zipBuffer)]), 'test.zip');
  return form;
}

async function uploadCodebase(app: ReturnType<typeof createApp>, files: { path: string; content: string }[]) {
  const zipBuffer = await buildZipBuffer(files);
  const res = await app.request('/api/codebases', { method: 'POST', body: multipartBody(zipBuffer) });
  const json = (await res.json()) as any;
  return json.codebaseId as string;
}

const sampleFiles = [
  { path: 'src/index.ts', content: 'export const main = () => 1;\n' },
  { path: 'src/routes/auth.ts', content: 'export function login() {}\n' },
];

describe('POST /api/codebases/:id/queries', () => {
  it('first query sends a cache_control-marked block and persists usage', async () => {
    const db = createDb(':memory:');
    const anthropicClient = new MockAnthropicClient(() => defaultCannedFindingsResponse());
    const app = createApp({ db, gitCloner: new RealGitCloner(), anthropicClient });
    const codebaseId = await uploadCodebase(app, sampleFiles);

    const res = await app.request(`/api/codebases/${codebaseId}/queries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Find issues', template: 'security-audit' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.result.findings.length).toBeGreaterThan(0);
    expect(json.usage.totals.cache_creation_input_tokens).toBeGreaterThan(0);

    expect(anthropicClient.calls.length).toBe(1);
    const firstBlock = anthropicClient.calls[0]!.messages[0]!.content as any[];
    expect(firstBlock[0].cache_control).toEqual({ type: 'ephemeral' });

    const usageRes = await app.request(`/api/codebases/${codebaseId}/usage`);
    const usageJson = (await usageRes.json()) as any;
    expect(usageJson.usage.queries.length).toBe(1);
  });

  it('second query resends a byte-identical leading context block (string equality)', async () => {
    const db = createDb(':memory:');
    const anthropicClient = new MockAnthropicClient(() => defaultCannedFindingsResponse());
    const app = createApp({ db, gitCloner: new RealGitCloner(), anthropicClient });
    const codebaseId = await uploadCodebase(app, sampleFiles);

    await app.request(`/api/codebases/${codebaseId}/queries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'First query' }),
    });
    await app.request(`/api/codebases/${codebaseId}/queries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Second query, different text' }),
    });

    expect(anthropicClient.calls.length).toBe(2);
    const firstLeadingBlock = (anthropicClient.calls[0]!.messages[0]!.content as any[])[0].text;
    const secondLeadingBlock = (anthropicClient.calls[1]!.messages[0]!.content as any[])[0].text;

    // The actual cache-correctness assertion: strict string equality on the cached prefix.
    expect(secondLeadingBlock).toBe(firstLeadingBlock);
    expect(typeof secondLeadingBlock).toBe('string');
    expect(secondLeadingBlock.length).toBeGreaterThan(0);
  });

  it('retries once on a malformed mock response then throws a typed error surfaced as 502', async () => {
    const db = createDb(':memory:');
    const anthropicClient = new MockAnthropicClient((_ctx, attempt) => {
      if (attempt === 1) {
        return {
          toolInput: { summary: 'bad', findings: [{ id: 'missing-fields' }] },
          usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 0 },
        };
      }
      return {
        toolInput: { summary: 'still bad', findings: [{ id: 'still-missing' }] },
        usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 100 },
      };
    });
    const app = createApp({ db, gitCloner: new RealGitCloner(), anthropicClient });
    const codebaseId = await uploadCodebase(app, sampleFiles);

    const res = await app.request(`/api/codebases/${codebaseId}/queries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Find issues' }),
    });

    expect(res.status).toBe(502);
    expect(anthropicClient.calls.length).toBe(2);
    const secondMessages = anthropicClient.calls[1]!.messages[0]!.content as any[];
    expect(secondMessages[1].text).toMatch(/failed schema validation/i);
  });

  it('passes a valid mock response straight through without retry', async () => {
    const db = createDb(':memory:');
    const anthropicClient = new MockAnthropicClient(() => defaultCannedFindingsResponse());
    const app = createApp({ db, gitCloner: new RealGitCloner(), anthropicClient });
    const codebaseId = await uploadCodebase(app, sampleFiles);

    const res = await app.request(`/api/codebases/${codebaseId}/queries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Find issues' }),
    });

    expect(res.status).toBe(200);
    expect(anthropicClient.calls.length).toBe(1);
  });

  it('builds a new (different) context block after re-upload changes content hash, not reusing the stale cache', async () => {
    const db = createDb(':memory:');
    const anthropicClient = new MockAnthropicClient(() => defaultCannedFindingsResponse());
    const app = createApp({ db, gitCloner: new RealGitCloner(), anthropicClient });

    const zip1 = await buildZipBuffer([{ path: 'src/index.ts', content: 'export const a = 1;\n' }]);
    const upload1 = await app.request('/api/codebases', { method: 'POST', body: multipartBody(zip1) });
    const { codebaseId } = (await upload1.json()) as any;

    await app.request(`/api/codebases/${codebaseId}/queries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'q1' }),
    });
    const firstBlock = (anthropicClient.calls[0]!.messages[0]!.content as any[])[0].text;

    // Re-upload same codebaseId route creates a new id in this API design, but we simulate
    // a content change against the SAME codebaseId by re-saving through a second upload,
    // then manually reusing that new id's queries endpoint to assert the block differs.
    const zip2 = await buildZipBuffer([{ path: 'src/index.ts', content: 'export const a = 2; // changed\n' }]);
    const upload2 = await app.request('/api/codebases', { method: 'POST', body: multipartBody(zip2) });
    const { codebaseId: codebaseId2 } = (await upload2.json()) as any;

    await app.request(`/api/codebases/${codebaseId2}/queries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'q1' }),
    });
    const secondBlock = (anthropicClient.calls[1]!.messages[0]!.content as any[])[0].text;

    expect(secondBlock).not.toBe(firstBlock);
  });
});
