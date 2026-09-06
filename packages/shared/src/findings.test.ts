import { describe, expect, it } from 'vitest';
import { FindingsResponseSchema } from './findings.js';

const validFinding = {
  id: 'f1',
  title: 'Hardcoded secret',
  category: 'security',
  severity: 'high',
  explanation: 'A secret key is hardcoded in source.',
  file_path: 'src/config.ts',
  line_start: 10,
  line_end: 12,
  code_snippet: 'const key = "abc123";',
};

describe('FindingsResponseSchema', () => {
  it('accepts a valid findings response', () => {
    const result = FindingsResponseSchema.safeParse({
      summary: 'Found one issue.',
      findings: [validFinding],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid finding with suggested_fix', () => {
    const result = FindingsResponseSchema.safeParse({
      summary: 'Found one issue.',
      findings: [
        {
          ...validFinding,
          suggested_fix: { description: 'Use env var', diff: '--- a\n+++ b\n' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a finding missing a required field', () => {
    const { title: _title, ...withoutTitle } = validFinding;
    const result = FindingsResponseSchema.safeParse({
      summary: 'x',
      findings: [withoutTitle],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('title'))).toBe(true);
    }
  });

  it('rejects a finding with an invalid severity enum value', () => {
    const result = FindingsResponseSchema.safeParse({
      summary: 'x',
      findings: [{ ...validFinding, severity: 'super-bad' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('severity'))).toBe(true);
    }
  });

  it('rejects a finding with a negative line number', () => {
    const result = FindingsResponseSchema.safeParse({
      summary: 'x',
      findings: [{ ...validFinding, line_start: -1 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('line_start'))).toBe(true);
    }
  });
});
