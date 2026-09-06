import { describe, expect, it } from 'vitest';
import { CodebaseManifestSchema } from './manifest.js';

const baseManifest = {
  codebaseId: 'cb_123',
  createdAt: new Date().toISOString(),
  sourceType: 'zip' as const,
  sourceRef: 'upload.zip',
  totalFiles: 2,
  totalBytes: 100,
  files: [
    {
      path: 'src/index.ts',
      language: 'typescript',
      lineCount: 10,
      sizeBytes: 50,
      isHighSignal: true,
    },
    {
      path: 'README.md',
      language: 'markdown',
      lineCount: 5,
      sizeBytes: 50,
      isHighSignal: false,
    },
  ],
  frameworks: [{ name: 'express', source: 'package.json' as const, version: '^4.0.0' }],
  highSignalFiles: ['src/index.ts'],
  contentHash: 'abc123hash',
};

describe('CodebaseManifestSchema', () => {
  it('accepts a valid manifest', () => {
    expect(CodebaseManifestSchema.safeParse(baseManifest).success).toBe(true);
  });

  it('rejects a manifest missing contentHash', () => {
    const { contentHash: _contentHash, ...rest } = baseManifest;
    expect(CodebaseManifestSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a manifest with wrong sourceType enum', () => {
    const result = CodebaseManifestSchema.safeParse({ ...baseManifest, sourceType: 'ftp' });
    expect(result.success).toBe(false);
  });

  it('rejects a file with a negative line count', () => {
    const result = CodebaseManifestSchema.safeParse({
      ...baseManifest,
      files: [{ ...baseManifest.files[0], lineCount: -5 }],
    });
    expect(result.success).toBe(false);
  });
});
