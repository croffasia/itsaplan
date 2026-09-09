import { describe, expect, it } from 'bun:test';
import { estimateCost } from '#modules/agents/core/runtime/model-pricing';

// The prices come from the table @mastra/observability bundles, so these check the
// lookup and the arithmetic against a few of its rows rather than the amounts
// themselves: a model priced as given, one whose dated name only matches after the
// release date is stripped, one whose cached tokens are billed at their own rate, and
// one the table does not price.

const NO_CACHE = { cacheReadTokens: 0, cacheWriteTokens: 0 };

describe('estimateCost', () => {
  it('bills input and output at the model rates', () => {
    // openai/gpt-5-mini: 2.5e-7 in, 2e-6 out.
    const cost = estimateCost('openai', 'gpt-5-mini', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      ...NO_CACHE,
    });
    expect(cost).toBeCloseTo(0.25 + 2, 6);
  });

  it('falls back to the undated name when the table prices no such release', () => {
    // anthropic/claude-3-5-haiku is priced; the dated spelling of it is not.
    const dated = estimateCost('anthropic', 'claude-3-5-haiku-20241022', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      ...NO_CACHE,
    });
    expect(dated).toBeCloseTo(0.8, 6);
  });

  it('bills cached input at the cache rate and the rest at the input rate', () => {
    // anthropic/claude-sonnet-4-5: 3e-6 in, 3e-7 cache read, 3.75e-6 cache write.
    const cost = estimateCost('anthropic', 'claude-sonnet-4-5', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 400_000,
      cacheWriteTokens: 100_000,
    });
    expect(cost).toBeCloseTo(0.5 * 3 + 0.4 * 0.3 + 0.1 * 3.75, 6);
  });

  it('reports nothing for a model the table does not price', () => {
    expect(
      estimateCost('openai', 'not-a-real-model', {
        inputTokens: 1000,
        outputTokens: 1000,
        ...NO_CACHE,
      }),
    ).toBeNull();
  });
});
