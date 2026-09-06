import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildManifest } from './manifest-builder.js';

let rootDir: string;

beforeAll(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'node_modules', 'foo'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'index.ts'), 'export const x = 1;\n');
  fs.writeFileSync(
    path.join(rootDir, 'src', 'routes', 'auth.ts'),
    'export function login() {}\n',
  );
  fs.writeFileSync(path.join(rootDir, 'README.md'), '# hello\n');
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({ dependencies: { express: '^4.0.0' } }),
  );
  fs.writeFileSync(path.join(rootDir, 'node_modules', 'foo', 'index.js'), 'module.exports = {}');
  fs.writeFileSync(path.join(rootDir, 'logo.png'), Buffer.from([0, 1, 2]));
});

afterAll(() => {
  fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('buildManifest', () => {
  it('ignores node_modules and binary files, detects language and frameworks', () => {
    const { manifest } = buildManifest({
      codebaseId: 'cb_1',
      sourceType: 'zip',
      sourceRef: 'test.zip',
      rootDir,
      tokenBudget: 60_000,
    });

    const paths = manifest.files.map((f) => f.path);
    expect(paths).not.toContain('node_modules/foo/index.js');
    expect(paths).not.toContain('logo.png');
    expect(paths).toContain('src/index.ts');

    const indexFile = manifest.files.find((f) => f.path === 'src/index.ts');
    expect(indexFile?.language).toBe('typescript');

    expect(manifest.frameworks.some((f) => f.name === 'express')).toBe(true);
  });

  it('marks entry points and auth/routes files as high signal', () => {
    const { manifest, highSignalFileContents } = buildManifest({
      codebaseId: 'cb_2',
      sourceType: 'zip',
      sourceRef: 'test.zip',
      rootDir,
      tokenBudget: 60_000,
    });

    expect(manifest.highSignalFiles).toContain('src/index.ts');
    expect(manifest.highSignalFiles).toContain('src/routes/auth.ts');
    expect(highSignalFileContents.get('src/index.ts')).toContain('export const x');
  });

  it('produces a stable content hash for identical high-signal content', () => {
    const run1 = buildManifest({
      codebaseId: 'cb_3',
      sourceType: 'zip',
      sourceRef: 'test.zip',
      rootDir,
      tokenBudget: 60_000,
    });
    const run2 = buildManifest({
      codebaseId: 'cb_3',
      sourceType: 'zip',
      sourceRef: 'test.zip',
      rootDir,
      tokenBudget: 60_000,
    });
    expect(run1.manifest.contentHash).toBe(run2.manifest.contentHash);
  });
});
