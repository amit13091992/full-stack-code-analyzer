import { describe, expect, it } from 'vitest';
import type { CodebaseManifest } from '@code-analyzer/shared';
import { buildContextBlock } from './context-builder.js';

function makeManifest(overrides: Partial<CodebaseManifest> = {}): CodebaseManifest {
  return {
    codebaseId: 'cb_1',
    createdAt: new Date().toISOString(),
    sourceType: 'zip',
    sourceRef: 'test.zip',
    totalFiles: 1,
    totalBytes: 10,
    files: [],
    frameworks: [],
    highSignalFiles: ['src/index.ts'],
    contentHash: 'hash1',
    ...overrides,
  };
}

describe('buildContextBlock', () => {
  it('is byte-identical across repeated calls with the same manifest and contents', () => {
    const manifest = makeManifest();
    const contents = new Map([['src/index.ts', 'export const x = 1;']]);
    const a = buildContextBlock(manifest, contents);
    const b = buildContextBlock(manifest, contents);
    expect(a.text).toBe(b.text);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it('changes when file content changes', () => {
    const manifest = makeManifest();
    const a = buildContextBlock(manifest, new Map([['src/index.ts', 'export const x = 1;']]));
    const b = buildContextBlock(manifest, new Map([['src/index.ts', 'export const x = 2;']]));
    expect(a.text).not.toBe(b.text);
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});
