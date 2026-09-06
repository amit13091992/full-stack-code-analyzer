import type { AnthropicUsage, UsageRecord } from '@code-analyzer/shared';
import type { Db } from './index.js';

// Published Anthropic pricing (Claude Sonnet), used only for the computed counterfactual
// and actual-cost estimate — approximate, illustrative, not a live billing measurement.
const PRICE_PER_MTOK_USD = {
  input: 3,
  output: 15,
  cacheWrite: 3.75,
  cacheRead: 0.3,
};

function costUsd(usage: AnthropicUsage): number {
  return (
    (usage.input_tokens / 1_000_000) * PRICE_PER_MTOK_USD.input +
    (usage.output_tokens / 1_000_000) * PRICE_PER_MTOK_USD.output +
    (usage.cache_creation_input_tokens / 1_000_000) * PRICE_PER_MTOK_USD.cacheWrite +
    (usage.cache_read_input_tokens / 1_000_000) * PRICE_PER_MTOK_USD.cacheRead
  );
}

export class UsageRepo {
  constructor(private db: Db) {}

  record(
    id: string,
    codebaseId: string,
    template: string | null,
    usage: AnthropicUsage,
  ): void {
    this.db
      .prepare(
        `INSERT INTO usage_records
          (id, codebase_id, created_at, template, input_tokens, output_tokens,
           cache_creation_input_tokens, cache_read_input_tokens)
         VALUES (@id, @codebase_id, @created_at, @template, @input_tokens, @output_tokens,
           @cache_creation_input_tokens, @cache_read_input_tokens)`,
      )
      .run({
        id,
        codebase_id: codebaseId,
        created_at: new Date().toISOString(),
        template,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      });
  }

  getUsageRecord(codebaseId: string): UsageRecord {
    const rows = this.db
      .prepare(
        `SELECT id, codebase_id, created_at, template, input_tokens, output_tokens,
                cache_creation_input_tokens, cache_read_input_tokens
         FROM usage_records WHERE codebase_id = ? ORDER BY created_at ASC`,
      )
      .all(codebaseId) as {
      id: string;
      codebase_id: string;
      created_at: string;
      template: string | null;
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    }[];

    const queries = rows.map((r) => ({
      id: r.id,
      codebaseId: r.codebase_id,
      createdAt: r.created_at,
      template: r.template,
      usage: {
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        cache_creation_input_tokens: r.cache_creation_input_tokens,
        cache_read_input_tokens: r.cache_read_input_tokens,
      },
    }));

    const totals = queries.reduce(
      (acc, q) => ({
        input_tokens: acc.input_tokens + q.usage.input_tokens,
        output_tokens: acc.output_tokens + q.usage.output_tokens,
        cache_creation_input_tokens:
          acc.cache_creation_input_tokens + q.usage.cache_creation_input_tokens,
        cache_read_input_tokens: acc.cache_read_input_tokens + q.usage.cache_read_input_tokens,
      }),
      { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    );

    const actualEstimatedCostUsd = queries.reduce((sum, q) => sum + costUsd(q.usage), 0);

    // No-cache baseline: what every query would have cost if it re-sent the full cached
    // context (biggest observed cache-write/read token count) as fresh input tokens.
    const assumedInputTokensPerQuery = Math.max(
      0,
      ...queries.map((q) => q.usage.cache_creation_input_tokens || q.usage.cache_read_input_tokens),
    );
    const queryCount = queries.length;
    const noCacheEstimatedCostUsd =
      (assumedInputTokensPerQuery * queryCount / 1_000_000) * PRICE_PER_MTOK_USD.input +
      queries.reduce((sum, q) => sum + (q.usage.output_tokens / 1_000_000) * PRICE_PER_MTOK_USD.output, 0);

    return {
      codebaseId,
      queries,
      totals,
      actualEstimatedCostUsd,
      noCacheBaseline: {
        isComputedCounterfactual: true,
        assumedInputTokensPerQuery,
        queryCount,
        estimatedCostUsd: noCacheEstimatedCostUsd,
      },
    };
  }
}
