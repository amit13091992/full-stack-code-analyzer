import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../app.js';
import { createDb } from '../db/index.js';
import { createDefaultMockClient } from '../lib/anthropic-client.js';
import type { GitCloner } from '../lib/git-clone.js';
import { buildZipBuffer, buildMaliciousZipBuffer } from '../test-helpers/zip-fixtures.js';
import { config } from '../config.js';

class MockGitCloner implements GitCloner {
  public lastArgs: { githubUrl: string; destDir: string } | undefined;

  async clone(githubUrl: string, destDir: string): Promise<void> {
    this.lastArgs = { githubUrl, destDir };
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'index.ts'), 'export const cloned = true;\n');
    fs.writeFileSync(
      path.join(destDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
    );
  }
}

function buildTestApp() {
  const db = createDb(':memory:');
  const gitCloner = new MockGitCloner();
  const app = createApp({ db, gitCloner, anthropicClient: createDefaultMockClient() });
  return { app, gitCloner };
}

function multipartBody(zipBuffer: Buffer, filename = 'test.zip'): { body: FormData } {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(zipBuffer)]), filename);
  return { body: form };
}

describe('POST /api/codebases (zip upload)', () => {
  it('accepts a valid zip and returns a correct manifest shape', async () => {
    const { app } = buildTestApp();
    const zipBuffer = await buildZipBuffer([
      { path: 'src/index.ts', content: 'export const main = 1;\n' },
      { path: 'src/routes/auth.ts', content: 'export function login() {}\n' },
      { path: 'package.json', content: JSON.stringify({ dependencies: { express: '1.0.0' } }) },
    ]);

    const { body } = multipartBody(zipBuffer);
    const res = await app.request('/api/codebases', { method: 'POST', body });

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.codebaseId).toMatch(/^cb_/);
    expect(json.manifest.files.some((f: any) => f.path === 'src/index.ts')).toBe(true);
    expect(json.manifest.highSignalFiles).toContain('src/routes/auth.ts');
    expect(json.manifest.frameworks.some((f: any) => f.name === 'express')).toBe(true);
    expect(json.skippedTraversalEntries).toEqual([]);
  });

  it('rejects and skips path-traversal entries in a malicious zip, writing nothing outside the extraction dir', async () => {
    const { app } = buildTestApp();
    const zipBuffer = await buildMaliciousZipBuffer();
    const { body } = multipartBody(zipBuffer, 'evil.zip');

    const res = await app.request('/api/codebases', { method: 'POST', body });
    expect(res.status).toBe(201);
    const json = (await res.json()) as any;

    expect(json.skippedTraversalEntries).toEqual(
      expect.arrayContaining(['../../etc/passwd', '../outside.txt']),
    );
    expect(json.manifest.files.some((f: any) => f.path === 'src/index.ts')).toBe(true);
    // The traversal entries must never appear as manifest files: they were skipped, not
    // written outside (or even inside) the extraction dir.
    expect(json.manifest.files.some((f: any) => f.path.includes('passwd'))).toBe(false);
    expect(json.manifest.files.some((f: any) => f.path.includes('outside.txt'))).toBe(false);
    expect(json.manifest.totalFiles).toBe(1);
  });

  it('rejects a zip over the configured size cap with a 4xx error', async () => {
    const { app } = buildTestApp();
    const bigContent = 'x'.repeat(config.maxUploadBytes + 1024);
    const zipBuffer = await buildZipBuffer([{ path: 'big.txt', content: bigContent }]);
    const { body } = multipartBody(zipBuffer, 'big.zip');

    const res = await app.request('/api/codebases', { method: 'POST', body });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const json = (await res.json()) as any;
    expect(json.error).toMatch(/size/i);
  });

  it('rejects a non-zip upload with a clean 400, not a raw crash', async () => {
    const { app } = buildTestApp();
    const { body } = multipartBody(Buffer.from('not a real zip file'), 'invalid.zip');

    const res = await app.request('/api/codebases', { method: 'POST', body });
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error).toMatch(/not a valid zip/i);
  });

  it('accepts a githubUrl request with the git-clone boundary mocked', async () => {
    const { app, gitCloner } = buildTestApp();
    const res = await app.request('/api/codebases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ githubUrl: 'https://github.com/example/repo' }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.manifest.sourceType).toBe('github');
    expect(json.manifest.sourceRef).toBe('https://github.com/example/repo');
    expect(gitCloner.lastArgs?.githubUrl).toBe('https://github.com/example/repo');
  });
});

describe('GET /api/codebases/:id', () => {
  it('returns the previously stored manifest', async () => {
    const { app } = buildTestApp();
    const zipBuffer = await buildZipBuffer([{ path: 'src/index.ts', content: 'export const a = 1;' }]);
    const { body } = multipartBody(zipBuffer);
    const uploadRes = await app.request('/api/codebases', { method: 'POST', body });
    const { codebaseId } = (await uploadRes.json()) as any;

    const getRes = await app.request(`/api/codebases/${codebaseId}`);
    expect(getRes.status).toBe(200);
    const json = (await getRes.json()) as any;
    expect(json.manifest.codebaseId).toBe(codebaseId);
  });

  it('returns 404 for an unknown codebase id', async () => {
    const { app } = buildTestApp();
    const res = await app.request('/api/codebases/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/codebases/:id/files/:path', () => {
  it('returns the content of a previously ingested high-signal file', async () => {
    const { app } = buildTestApp();
    const zipBuffer = await buildZipBuffer([
      { path: 'src/routes/auth.ts', content: 'export function login() {}\n' },
    ]);
    const { body } = multipartBody(zipBuffer);
    const uploadRes = await app.request('/api/codebases', { method: 'POST', body });
    const { codebaseId } = (await uploadRes.json()) as any;

    const res = await app.request(`/api/codebases/${codebaseId}/files/src/routes/auth.ts`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.path).toBe('src/routes/auth.ts');
    expect(json.content).toBe('export function login() {}\n');
  });

  it('returns 404 for a file that was not ingested', async () => {
    const { app } = buildTestApp();
    const zipBuffer = await buildZipBuffer([{ path: 'src/index.ts', content: 'export const a = 1;' }]);
    const { body } = multipartBody(zipBuffer);
    const uploadRes = await app.request('/api/codebases', { method: 'POST', body });
    const { codebaseId } = (await uploadRes.json()) as any;

    const res = await app.request(`/api/codebases/${codebaseId}/files/src/does-not-exist.ts`);
    expect(res.status).toBe(404);
  });
});
