import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// What a model call costs, in USD, from the token counts its span reports.
//
// A workspace may set its own price for a model (OwnPrices), which wins over the table.
// The table is the one @mastra/observability bundles for its own cost metrics
// (`dist/metrics/pricing-data.json`, the models.dev catalog: prices per million tokens by
// provider and model). Those metrics need an analytics store its Postgres adapter does not
// implement, so the spans reach us carrying raw token counts and the price is applied here
// instead. The provider ids are the same registry our AI_PROVIDERS list comes from, so a
// credential's integration key matches the table directly.
//
// The file is not in the package's exports map, so a release that moves it leaves the
// table empty rather than failing the request: an unpriced call reports no cost, and
// the dashboard shows its tokens without one.

// A model's prices in the models.dev shape, USD per million tokens. `tiers` holds the
// prices of long inputs, each from `tier.size` input tokens of one call.
interface Cost {
  input?: unknown;
  output?: unknown;
  cache_read?: unknown;
  cache_write?: unknown;
  tiers?: (Cost & { tier?: { type?: string; size?: unknown } })[];
}

type PricingData = Record<string, { models: Record<string, { cost: Cost }> }>;

// The token counts of one model call, as the span's `usage` attribute reports them.
// inputTokens is the whole input, cached tokens included, so the tokens billed at the
// plain input rate are what is left after the cache counts are taken out.
export interface CallUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

// A price per million tokens, as a person reads and sets one. A cache rate is null
// where the model bills those tokens at the input rate.
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number | null;
  cacheWrite: number | null;
}

// The prices a workspace set itself (the model_price table), by priceKey. They win over
// the built-in table, for the model as reported and for each of its variants.
export type OwnPrices = ReadonlyMap<string, ModelPrice>;

// A row of the built-in table that prices a call: it has an input and an output rate.
export interface BuiltInPrice {
  provider: string;
  model: string;
  price: ModelPrice;
}

// The base price, and the prices of long inputs from the largest input down.
interface Priced {
  base: ModelPrice;
  long: { fromInput: number; price: ModelPrice }[];
}

interface Table {
  byKey: Map<string, Priced>;
  // In provider, then model order, for a reader paging through them.
  listed: BuiltInPrice[];
}

let table: Table | null = null;

function pricingPath(): string {
  const packageJson = createRequire(import.meta.url).resolve('@mastra/observability/package.json');
  return path.join(path.dirname(packageJson), 'dist', 'metrics', 'pricing-data.json');
}

export function priceKey(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}`;
}

// A price of zero is left out, as Mastra's own cost metrics leave it out: it marks a
// free endpoint or a flat-fee plan, not a per-token rate.
function rate(value: unknown): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

function priceOf(cost: Cost): ModelPrice | null {
  const input = rate(cost.input);
  const output = rate(cost.output);
  if (input == null || output == null) return null;
  return { input, output, cacheRead: rate(cost.cache_read), cacheWrite: rate(cost.cache_write) };
}

function pricedOf(cost: Cost): Priced | null {
  const base = priceOf(cost);
  if (!base) return null;
  const long = (cost.tiers ?? []).flatMap((tier) => {
    const size = tier.tier?.size;
    const price = priceOf(tier);
    return (tier.tier?.type ?? 'context') === 'context' && typeof size === 'number' && price
      ? [{ fromInput: size, price }]
      : [];
  });
  return { base, long: long.sort((a, b) => b.fromInput - a.fromInput) };
}

function load(): Table {
  const loaded: Table = { byKey: new Map(), listed: [] };
  try {
    const data = JSON.parse(readFileSync(pricingPath(), 'utf-8')) as PricingData;
    for (const [provider, { models }] of Object.entries(data)) {
      for (const [model, { cost }] of Object.entries(models)) {
        const priced = pricedOf(cost);
        if (!priced) continue;
        // Keyed with dots as dashes, the spelling modelVariants looks up for either one.
        const key = priceKey(provider, model.replace(/\./g, '-'));
        if (!loaded.byKey.has(key)) loaded.byKey.set(key, priced);
        loaded.listed.push({ provider, model, price: priced.base });
      }
    }
  } catch (error) {
    console.error('[agent-analytics] model prices unavailable:', error);
  }
  loaded.listed.sort(
    (a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model),
  );
  return loaded;
}

function prices(): Table {
  if (!table) table = load();
  return table;
}

// A model id as the table may spell it: as reported, with dots normalized to dashes,
// and each of those without the release date providers append.
function modelVariants(model: string): string[] {
  const out = new Set<string>();
  for (const base of [model, model.replace(/\./g, '-')]) {
    out.add(base);
    out.add(
      base
        .replace(/@20\d{6}$/, '')
        .replace(/-20\d{2}-\d{2}-\d{2}$/, '')
        .replace(/-20\d{6}(-[a-z]+)?$/, '$1'),
    );
  }
  return [...out];
}

// The first entry of `map` under the model as reported or one of its variants.
export function findPrice<T>(
  map: ReadonlyMap<string, T>,
  provider: string,
  model: string,
): T | null {
  for (const variant of modelVariants(model)) {
    const found = map.get(priceKey(provider, variant));
    if (found) return found;
  }
  return null;
}

// The built-in price of a model as the dashboard reports it, or null when the table
// prices no such model. The prices of long inputs are left out: a person compares their
// own price with the base one.
export function builtInPrice(provider: string, model: string): ModelPrice | null {
  return findPrice(prices().byKey, provider, model)?.base ?? null;
}

// One window of the built-in table, narrowed to the rows whose `provider/model` holds
// `search`, ignoring case.
export function listBuiltInPrices(
  search: string | undefined,
  window: { limit: number; offset: number },
): { items: BuiltInPrice[]; total: number } {
  const term = search?.trim().toLowerCase();
  const rows = term
    ? prices().listed.filter((row) => `${row.provider}/${row.model}`.toLowerCase().includes(term))
    : prices().listed;
  return { items: rows.slice(window.offset, window.offset + window.limit), total: rows.length };
}

// What model calls cost, or null when neither the workspace's own prices nor the table
// price such a model. `usage` is the sum of `calls` calls; a long-input price is chosen by
// the input of one call, so a sum is priced as its average call. An own price has no
// long-input prices. Cached reads and writes are billed at their own rates where the model
// has them, and at the plain input rate where it does not.
// Calls of very different sizes in one sum share a price; pricing each call would need
// one row per call.
export function estimateCost(
  provider: string,
  model: string,
  usage: CallUsage,
  calls = 1,
  own: OwnPrices = new Map(),
): number | null {
  const set = findPrice(own, provider, model);
  if (set) return costAt(usage, set);
  const priced = findPrice(prices().byKey, provider, model);
  if (!priced) return null;
  const callInput = usage.inputTokens / Math.max(calls, 1);
  const long = priced.long.find((band) => callInput >= band.fromInput);
  return costAt(usage, long?.price ?? priced.base);
}

function costAt(usage: CallUsage, price: ModelPrice): number {
  const plainInput = Math.max(
    0,
    usage.inputTokens - usage.cacheReadTokens - usage.cacheWriteTokens,
  );
  const perMillion =
    plainInput * price.input +
    usage.cacheReadTokens * (price.cacheRead ?? price.input) +
    usage.cacheWriteTokens * (price.cacheWrite ?? price.input) +
    usage.outputTokens * price.output;
  return perMillion / 1e6;
}
