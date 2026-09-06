import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { FindingsResponseJsonSchema, DependencyMapResponseJsonSchema } from './json-schema.js';

describe('generated JSON Schemas', () => {
  it('FindingsResponse JSON schema validates a valid object via ajv', () => {
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(FindingsResponseJsonSchema);
    const ok = validate({
      summary: 'ok',
      findings: [
        {
          id: 'f1',
          title: 't',
          category: 'security',
          severity: 'low',
          explanation: 'e',
          file_path: 'a.ts',
          line_start: 1,
          line_end: 2,
          code_snippet: 'x',
        },
      ],
    });
    expect(ok).toBe(true);
  });

  it('FindingsResponse JSON schema rejects an invalid object via ajv', () => {
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(FindingsResponseJsonSchema);
    const ok = validate({ summary: 'ok', findings: [{ id: 'f1' }] });
    expect(ok).toBe(false);
  });

  it('DependencyMapResponse JSON schema validates a valid object via ajv', () => {
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(DependencyMapResponseJsonSchema);
    const ok = validate({
      summary: 'ok',
      nodes: [{ id: 'n1', label: 'Node', file_path: 'a.ts', kind: 'module' }],
      edges: [{ from: 'n1', to: 'n1', relationship: 'imports' }],
    });
    expect(ok).toBe(true);
  });
});
