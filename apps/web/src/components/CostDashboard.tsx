import type { UsageRecord } from '@code-analyzer/shared';

export interface CostDashboardProps {
  usage: UsageRecord;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

export default function CostDashboard({ usage }: CostDashboardProps) {
  const savingsUsd = usage.noCacheBaseline.estimatedCostUsd - usage.actualEstimatedCostUsd;
  const savingsPct =
    usage.noCacheBaseline.estimatedCostUsd > 0
      ? (savingsUsd / usage.noCacheBaseline.estimatedCostUsd) * 100
      : 0;
  const cacheHitCount = usage.queries.filter((q) => q.usage.cache_read_input_tokens > 0).length;

  return (
    <section aria-label="Cost dashboard" className="space-y-4">
      <h2 className="text-lg font-semibold">Cost dashboard</h2>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Input tokens</dt>
          <dd data-testid="total-input-tokens">{usage.totals.input_tokens}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Output tokens</dt>
          <dd data-testid="total-output-tokens">{usage.totals.output_tokens}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Cache write tokens</dt>
          <dd data-testid="total-cache-write-tokens">
            {usage.totals.cache_creation_input_tokens}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Cache read tokens</dt>
          <dd data-testid="total-cache-read-tokens">{usage.totals.cache_read_input_tokens}</dd>
        </div>
      </dl>

      <p data-testid="cache-hit-indicator">
        {cacheHitCount > 0
          ? `Cache hit on ${cacheHitCount} of ${usage.queries.length} queries.`
          : 'No cache hits yet.'}
      </p>

      <div className="rounded border border-slate-300 p-3">
        <h3 className="font-medium">Cached vs. no-cache cost comparison</h3>
        <p className="text-sm text-slate-600">
          No-cache baseline is a computed counterfactual, not a live measurement.
        </p>
        <div className="mt-2 flex gap-6">
          <div>
            <dt className="text-xs text-slate-500">With caching (actual)</dt>
            <dd data-testid="actual-cost-usd">{formatUsd(usage.actualEstimatedCostUsd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Without caching (baseline)</dt>
            <dd data-testid="no-cache-baseline-usd">
              {formatUsd(usage.noCacheBaseline.estimatedCostUsd)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Savings</dt>
            <dd data-testid="savings-usd">
              {formatUsd(savingsUsd)} ({savingsPct.toFixed(1)}%)
            </dd>
          </div>
        </div>
      </div>
    </section>
  );
}
