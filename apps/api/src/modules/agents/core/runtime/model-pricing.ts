import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// What a model call costs, in USD, from the token counts its span reports.
//
// The prices are the table @mastra/observability bundles for its own cost metrics
// (`dist/metrics/pricing-data.jsonl`, ~6400 provider/model pairs). Those metrics need
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

interface Tier {
  // Conditions on the call, all of which must hold. Only the total input token count
  // ('tit') is used as a condition in the table.
  w?: { f: string; op: string; value: number }[];
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

let table: Map<string, Tier[]> | null = null;

function pricingPath(): string {
  const packageJson = createRequire(import.meta.url).resolve('@mastra/observability/package.json');
  return path.join(path.dirname(packageJson), 'dist', 'metrics', 'pricing-data.jsonl');
}

function key(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}`;
}

function load(): Map<string, Tier[]> {
  const loaded = new Map<string, Tier[]>();
  try {
    for (const line of readFileSync(pricingPath(), 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as PricingRow;
      loaded.set(key(row.p, row.m), row.s.d.t);
    }
  } catch (error) {
    console.error('[agent-analytics] model prices unavailable:', error);
  }
  return loaded;
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

function tiersFor(provider: string, model: string): Tier[] | null {
  if (!table) table = load();
  for (const variant of modelVariants(model)) {
    const tiers = table.get(key(provider, variant));
    if (tiers) return tiers;
  }
  return null;
}

function holds(condition: { f: string; op: string; value: number }, inputTokens: number): boolean {
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

// What one model call cost, or null when the table prices no such model. Cached reads
// and writes are billed at their own rates where the model has them, and at the plain
// input rate where it does not.
export function estimateCost(provider: string, model: string, usage: CallUsage): number | null {
  const tiers = tiersFor(provider, model);
  if (!tiers) return null;
  const tier = tierFor(tiers, usage.inputTokens);
  const input = tier?.r.it?.c;
  const output = tier?.r.ot?.c;
  if (!tier || input == null || output == null) return null;

  const cacheRead = tier.r.icrt?.c ?? input;
  const cacheWrite = tier.r.icwt?.c ?? input;
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
