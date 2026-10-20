import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// What a model call costs, in USD, from the token counts its span reports.
//
// A workspace may set its own price for a model (OwnPrices), which wins over the table.
// The table is the one @mastra/observability bundles for its own cost metrics
// (`dist/metrics/pricing-data.jsonl`, one row per provider and model). Those metrics need
// an analytics store its Postgres adapter does not implement, so the spans reach us
// carrying raw token counts and the price is applied here instead. The provider ids
// are the same registry our AI_PROVIDERS list comes from, so a credential's
// integration key matches the table directly.
//
// The file is not in the package's exports map, so a release that moves it leaves the
// table empty rather than failing the request: an unpriced call reports no cost, and
// the dashboard shows its tokens without one.

// The prices of one provider/model pair. Rates are USD per token, keyed by the
// meter the tokens are billed under; a tier applies once its conditions hold.
interface Rate {
  c: number;
}

// Only the total input token count ('tit') is used as a condition in the table.
type Condition = { f: string; op: string; value: number };

interface Tier {
  w?: Condition[];
  r: Record<string, Rate | undefined>;
}

interface PricingRow {
  p: string;
  m: string;
  s: { d: { u: string; t: Tier[] } };
}

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

interface Table {
  byKey: Map<string, Tier[]>;
  // In provider, then model order, for a reader paging through them.
  listed: BuiltInPrice[];
}

let table: Table | null = null;

function pricingPath(): string {
  const packageJson = createRequire(import.meta.url).resolve('@mastra/observability/package.json');
  return path.join(path.dirname(packageJson), 'dist', 'metrics', 'pricing-data.jsonl');
}

export function priceKey(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}`;
}

function load(): Table {
  const loaded: Table = { byKey: new Map(), listed: [] };
  try {
    for (const line of readFileSync(pricingPath(), 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as PricingRow;
      loaded.byKey.set(priceKey(row.p, row.m), row.s.d.t);
      const price = basePrice(row.s.d.t);
      if (price) loaded.listed.push({ provider: row.p, model: row.m, price });
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

// USD per token to USD per million tokens, without the float noise of the product.
function perMillion(rate: Rate | undefined): number | null {
  return rate ? Number((rate.c * 1e6).toPrecision(12)) : null;
}

// What the base tier, the one with no conditions, charges: what a person compares
// their own price with. A tier for long inputs is left out.
function basePrice(tiers: Tier[]): ModelPrice | null {
  const rates = tiers[0]?.r;
  const input = perMillion(rates?.it);
  const output = perMillion(rates?.ot);
  if (!rates || input == null || output == null) return null;
  return { input, output, cacheRead: perMillion(rates.icrt), cacheWrite: perMillion(rates.icwt) };
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
// prices no such model.
export function builtInPrice(provider: string, model: string): ModelPrice | null {
  const tiers = findPrice(prices().byKey, provider, model);
  return tiers ? basePrice(tiers) : null;
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

function holds(condition: Condition, inputTokens: number): boolean {
  if (condition.f !== 'tit') return false;
  switch (condition.op) {
    case 'gt':
      return inputTokens > condition.value;
    case 'gte':
      return inputTokens >= condition.value;
    case 'lt':
      return inputTokens < condition.value;
    case 'lte':
      return inputTokens <= condition.value;
    case 'eq':
      return inputTokens === condition.value;
    case 'neq':
      return inputTokens !== condition.value;
    default:
      return false;
  }
}

// The first tier whose conditions hold, or the base tier, which carries none.
function tierFor(tiers: Tier[], inputTokens: number): Tier | null {
  for (const tier of tiers) {
    if (tier.w?.length && tier.w.every((condition) => holds(condition, inputTokens))) return tier;
  }
  return tiers[0] ?? null;
}

// What model calls cost, or null when neither the workspace's own prices nor the table
// price such a model. `usage` is the sum of `calls` calls; a tier is chosen by the input
// of one call, so a sum is priced at the tier of its average call. An own price has one
// tier. Cached reads and writes are billed at their own rates where the model has them,
// and at the plain input rate where it does not.
// Calls of very different sizes in one sum share a tier; pricing each call would need
// one row per call.
export function estimateCost(
  provider: string,
  model: string,
  usage: CallUsage,
  calls = 1,
  own: OwnPrices = new Map(),
): number | null {
  const set = findPrice(own, provider, model);
  if (set) {
    const input = set.input / 1e6;
    return costAt(usage, {
      input,
      output: set.output / 1e6,
      cacheRead: set.cacheRead != null ? set.cacheRead / 1e6 : input,
      cacheWrite: set.cacheWrite != null ? set.cacheWrite / 1e6 : input,
    });
  }
  const tiers = findPrice(prices().byKey, provider, model);
  if (!tiers) return null;
  const tier = tierFor(tiers, usage.inputTokens / Math.max(calls, 1));
  const input = tier?.r.it?.c;
  const output = tier?.r.ot?.c;
  if (!tier || input == null || output == null) return null;
  return costAt(usage, {
    input,
    output,
    cacheRead: tier.r.icrt?.c ?? input,
    cacheWrite: tier.r.icwt?.c ?? input,
  });
}

// USD per token, by the meter the tokens are billed under.
interface Rates {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function costAt(usage: CallUsage, { input, output, cacheRead, cacheWrite }: Rates): number {
  const plainInput = Math.max(
    0,
    usage.inputTokens - usage.cacheReadTokens - usage.cacheWriteTokens,
  );
  return (
    plainInput * input +
    usage.cacheReadTokens * cacheRead +
    usage.cacheWriteTokens * cacheWrite +
    usage.outputTokens * output
  );
}
