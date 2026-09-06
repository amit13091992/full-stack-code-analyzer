import { describe, expect, it } from 'vitest';
import { UsageRecordSchema } from './usage.js';

const baseUsage = {
  codebaseId: 'cb_1',
  queries: [
    {
      id: 'q1',
      codebaseId: 'cb_1',
      createdAt: new Date().toISOString(),
      template: 'security-audit',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 5000,
        cache_read_input_tokens: 0,
      },
    },
  ],
  totals: {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: 5000,
    cache_read_input_tokens: 0,
  },
  actualEstimatedCostUsd: 0.05,
  noCacheBaseline: {
    isComputedCounterfactual: true as const,
    assumedInputTokensPerQuery: 5100,
    queryCount: 1,
    estimatedCostUsd: 0.06,
  },
};

describe('UsageRecordSchema', () => {
  it('accepts a valid usage record', () => {
    expect(UsageRecordSchema.safeParse(baseUsage).success).toBe(true);
  });

  it('rejects noCacheBaseline missing isComputedCounterfactual flag', () => {
    const { isComputedCounterfactual: _f, ...rest } = baseUsage.noCacheBaseline;
    const result = UsageRecordSchema.safeParse({
      ...baseUsage,
      noCacheBaseline: rest,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative token counts', () => {
    const result = UsageRecordSchema.safeParse({
      ...baseUsage,
      totals: { ...baseUsage.totals, input_tokens: -1 },
    });
    expect(result.success).toBe(false);
  });
});
