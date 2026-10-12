import { describe, expect, it } from 'bun:test';
import {
  builtInPrice,
  estimateCost,
  listBuiltInPrices,
  priceKey,
  type ModelPrice,
} from '#modules/agents/core/runtime/model-pricing';

// The prices come from the table @mastra/observability bundles, so these check the
// lookup and the arithmetic against a few of its rows rather than the amounts
// themselves: a model priced as given, one whose dated name only matches after the
// release date is stripped, one whose cached tokens are billed at their own rate, and
// one the table does not price. A workspace's own price wins over the table, for the
// model as reported and for its undated name.

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

  it('picks the tier by the average call of a sum', () => {
    // google/gemini-2-5-pro: 1.25e-6 in up to 200K input tokens, 2.5e-6 above.
    const usage = { inputTokens: 1_000_000, outputTokens: 0, ...NO_CACHE };
    expect(estimateCost('google', 'gemini-2.5-pro', usage, 10)).toBeCloseTo(1.25, 6);
    expect(estimateCost('google', 'gemini-2.5-pro', usage)).toBeCloseTo(2.5, 6);
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

  it('bills at the price the workspace set, over the table', () => {
    const own = new Map<string, ModelPrice>([
      [
        priceKey('anthropic', 'claude-sonnet-4-5'),
        { input: 1, output: 2, cacheRead: null, cacheWrite: 0.5 },
      ],
      [
        priceKey('openai-compatible', 'qwen'),
        { input: 0.2, output: 0.6, cacheRead: null, cacheWrite: null },
      ],
    ]);
    // The dated release is reported, the price is set for the undated name. A cache read
    // with no rate of its own is billed at the input rate.
    const cost = estimateCost(
      'anthropic',
      'claude-sonnet-4-5-20250929',
      {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 200_000,
        cacheWriteTokens: 200_000,
      },
      1,
      own,
    );
    expect(cost).toBeCloseTo(0.6 * 1 + 0.2 * 1 + 0.2 * 0.5 + 2, 6);
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, ...NO_CACHE };
    expect(estimateCost('OpenAI-Compatible', 'Qwen', usage, 1, own)).toBeCloseTo(0.8, 6);
  });
});

describe('the built-in prices', () => {
  it('reads a model per million tokens, without float noise', () => {
    expect(builtInPrice('openai', 'gpt-5-mini')).toEqual({
      input: 0.25,
      output: 2,
      cacheRead: 0.025,
      cacheWrite: null,
    });
    expect(builtInPrice('openai', 'not-a-real-model')).toBeNull();
  });

  it('lists them in provider and model order, narrowed by any part of provider/model', () => {
    const all = listBuiltInPrices(undefined, { limit: 3, offset: 0 });
    expect(all.items).toHaveLength(3);
    const names = all.items.map((row) => `${row.provider}/${row.model}`);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);

    const found = listBuiltInPrices('ANTHROPIC/claude-sonnet-4-5', { limit: 50, offset: 0 });
    // Gateways list the model as `anthropic/claude-sonnet-4-5` under their own name.
    expect(
      found.items.some((row) => row.provider === 'anthropic' && row.model === 'claude-sonnet-4-5'),
    ).toBe(true);
    expect(
      found.items.every((row) =>
        `${row.provider}/${row.model}`.includes('anthropic/claude-sonnet-4-5'),
      ),
    ).toBe(true);
    expect(found.total).toBe(found.items.length);
  });
});
