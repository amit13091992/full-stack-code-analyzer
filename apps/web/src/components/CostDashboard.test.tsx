import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CostDashboard from './CostDashboard.js';
import { fixtureUsageRecords } from '../fixtures/index.js';

describe('CostDashboard', () => {
  it('renders running totals from the usage record', () => {
    render(<CostDashboard usage={fixtureUsageRecords} />);

    expect(screen.getByTestId('total-input-tokens')).toHaveTextContent('1000');
    expect(screen.getByTestId('total-output-tokens')).toHaveTextContent('400');
    expect(screen.getByTestId('total-cache-write-tokens')).toHaveTextContent('5000');
    expect(screen.getByTestId('total-cache-read-tokens')).toHaveTextContent('5000');
  });

  it('shows a cache-hit indicator counting queries with cache_read_input_tokens > 0', () => {
    render(<CostDashboard usage={fixtureUsageRecords} />);
    // Fixture has 2 queries, the 2nd (only) has cache_read_input_tokens > 0.
    expect(screen.getByTestId('cache-hit-indicator')).toHaveTextContent('Cache hit on 1 of 2 queries.');
  });

  it('shows "no cache hits yet" when no query has a cache read', () => {
    const noHits = {
      ...fixtureUsageRecords,
      queries: fixtureUsageRecords.queries.map((q) => ({
        ...q,
        usage: { ...q.usage, cache_read_input_tokens: 0 },
      })),
    };
    render(<CostDashboard usage={noHits} />);
    expect(screen.getByTestId('cache-hit-indicator')).toHaveTextContent(/no cache hits yet/i);
  });

  it('computes the cached-vs-no-cache comparison against hand-computed expected numbers', () => {
    render(<CostDashboard usage={fixtureUsageRecords} />);

    // actualEstimatedCostUsd = 0.0075, noCacheBaseline.estimatedCostUsd = 0.0312
    // savings = 0.0312 - 0.0075 = 0.0237; savings% = 0.0237 / 0.0312 * 100 = 76.0
    expect(screen.getByTestId('actual-cost-usd')).toHaveTextContent('$0.0075');
    expect(screen.getByTestId('no-cache-baseline-usd')).toHaveTextContent('$0.0312');
    expect(screen.getByTestId('savings-usd')).toHaveTextContent('$0.0237 (76.0%)');
  });
});
