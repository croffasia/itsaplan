import { db, aiAgent } from '@repo/db';
import { eq } from 'drizzle-orm';
import { num } from '#shared/lib';
import { agentCostSince } from './runtime/analytics';

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// The reason an internal agent may not work, when its monthly budget is spent.
export async function budgetRefusal(teamId: number, agentId: number): Promise<string | null> {
  const [row] = await db
    .select({ budget: aiAgent.monthlyBudgetUsd })
    .from(aiAgent)
    .where(eq(aiAgent.id, agentId));
  if (row?.budget == null) return null;
  const budget = num(row.budget);
  const spent = await agentCostSince(teamId, agentId, monthStart());
  if (spent < budget) return null;
  return `The agent's monthly budget of $${budget.toFixed(2)} is spent`;
}
