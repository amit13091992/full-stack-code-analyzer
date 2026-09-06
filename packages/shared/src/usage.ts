import { z } from 'zod';

export const AnthropicUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_creation_input_tokens: z.number().int().nonnegative().optional().default(0),
  cache_read_input_tokens: z.number().int().nonnegative().optional().default(0),
});
export type AnthropicUsage = z.infer<typeof AnthropicUsageSchema>;

export const UsageQueryRecordSchema = z.object({
  id: z.string().min(1),
  codebaseId: z.string().min(1),
  createdAt: z.string().datetime(),
  template: z.string().nullable(),
  usage: AnthropicUsageSchema,
});
export type UsageQueryRecord = z.infer<typeof UsageQueryRecordSchema>;

/**
 * noCacheBaselineCost is a COMPUTED COUNTERFACTUAL: what it would have cost if every
 * query re-sent the full cached block as fresh input tokens instead of hitting the cache.
 * It is never a live measurement.
 */
export const NoCacheBaselineSchema = z.object({
  isComputedCounterfactual: z.literal(true),
  assumedInputTokensPerQuery: z.number().int().nonnegative(),
  queryCount: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
});
export type NoCacheBaseline = z.infer<typeof NoCacheBaselineSchema>;

export const UsageRecordSchema = z.object({
  codebaseId: z.string().min(1),
  queries: z.array(UsageQueryRecordSchema),
  totals: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cache_creation_input_tokens: z.number().int().nonnegative(),
    cache_read_input_tokens: z.number().int().nonnegative(),
  }),
  actualEstimatedCostUsd: z.number().nonnegative(),
  noCacheBaseline: NoCacheBaselineSchema,
});
export type UsageRecord = z.infer<typeof UsageRecordSchema>;
