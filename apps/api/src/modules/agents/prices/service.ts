import { db, modelPrice } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { modelsCalled, workspaceScope } from '../core/runtime/analytics';
import {
  builtInPrice,
  findPrice,
  listBuiltInPrices,
  priceKey,
  type ModelPrice,
} from '../core/runtime/model-pricing';

// The price list of a workspace: the built-in table, and the prices the workspace set
// itself, which the agent dashboard reads first (analytics.ts, ownPrices). Both lists
// show the two side by side, so a person sees what a model costs now and what it would
// cost without their price.

export interface OwnPrice extends ModelPrice {
  id: number;
  provider: string;
  model: string;
}

export interface ModelPriceRow {
  provider: string;
  model: string;
  builtIn: ModelPrice | null;
  own: OwnPrice | null;
}

// How far back the list of the models a workspace uses looks.
const USED_DAYS = 90;

const ownColumns = {
  id: modelPrice.id,
  provider: modelPrice.provider,
  model: modelPrice.model,
  input: modelPrice.input,
  output: modelPrice.output,
  cacheRead: modelPrice.cacheRead,
  cacheWrite: modelPrice.cacheWrite,
};

async function ownPricesByKey(workspaceId: number): Promise<Map<string, OwnPrice>> {
  const rows = await db
    .select(ownColumns)
    .from(modelPrice)
    .where(eq(modelPrice.workspaceId, workspaceId))
    .orderBy(modelPrice.provider, modelPrice.model);
  return new Map(rows.map((price) => [priceKey(price.provider, price.model), price]));
}

// The models the workspace's agents called in the last 90 days, and those it set a
// price for without calling them since. A model no price covers comes first, since its
// calls are left out of the dashboard's cost; then the most called.
export async function listUsedModelPrices(
  workspaceId: number,
): Promise<(ModelPriceRow & { calls: number })[]> {
  const from = new Date(Date.now() - USED_DAYS * 24 * 60 * 60 * 1000);
  const [called, own] = await Promise.all([
    workspaceScope(workspaceId).then((scope) => modelsCalled(scope, from)),
    ownPricesByKey(workspaceId),
  ]);
  const shown = new Set<number>();
  const rows = called.map((row) => {
    const set = findPrice(own, row.provider, row.model);
    if (set) shown.add(set.id);
    return { ...row, builtIn: builtInPrice(row.provider, row.model), own: set };
  });
  for (const price of own.values()) {
    if (shown.has(price.id)) continue;
    const { provider, model } = price;
    rows.push({ provider, model, calls: 0, builtIn: builtInPrice(provider, model), own: price });
  }
  const priced = (row: ModelPriceRow) => (row.own || row.builtIn ? 1 : 0);
  return rows.sort((a, b) => priced(a) - priced(b) || b.calls - a.calls);
}

// One window of the built-in table, each row with the workspace's own price for that
// exact model when it set one.
export async function listCatalogPrices(
  workspaceId: number,
  search: string | undefined,
  window: { limit: number; offset: number },
): Promise<{ items: ModelPriceRow[]; total: number }> {
  const { items, total } = listBuiltInPrices(search, window);
  const own = await ownPricesByKey(workspaceId);
  return {
    items: items.map((row) => ({
      provider: row.provider,
      model: row.model,
      builtIn: row.price,
      own: own.get(priceKey(row.provider, row.model)) ?? null,
    })),
    total,
  };
}

// Sets the workspace's price for a model, replacing the one it had. The model is named
// as the dashboard reports it or as the table lists it, in any case.
export async function setModelPrice(
  workspaceId: number,
  input: {
    provider: string;
    model: string;
    input: number;
    output: number;
    cacheRead?: number | null;
    cacheWrite?: number | null;
  },
): Promise<OwnPrice> {
  const rates = {
    input: input.input,
    output: input.output,
    cacheRead: input.cacheRead ?? null,
    cacheWrite: input.cacheWrite ?? null,
  };
  const [row] = await db
    .insert(modelPrice)
    .values({
      workspaceId,
      provider: input.provider.trim().toLowerCase(),
      model: input.model.trim().toLowerCase(),
      ...rates,
    })
    .onConflictDoUpdate({
      target: [modelPrice.workspaceId, modelPrice.provider, modelPrice.model],
      set: { ...rates, updatedAt: new Date() },
    })
    .returning(ownColumns);
  return row;
}

// Drops the workspace's price, so the model is costed at the built-in one again, or
// not at all. False when the workspace has no such price.
export async function deleteModelPrice(workspaceId: number, id: number): Promise<boolean> {
  const rows = await db
    .delete(modelPrice)
    .where(and(eq(modelPrice.id, id), eq(modelPrice.workspaceId, workspaceId)))
    .returning({ id: modelPrice.id });
  return rows.length > 0;
}
