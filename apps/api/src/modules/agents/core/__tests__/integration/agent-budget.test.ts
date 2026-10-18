import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SpanType } from '@mastra/core/observability';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf, teamOf } from '#tests/helpers/agents';
import { getStore } from '../../runtime/store';
import { processAgentRuns } from '../../run-poller';
import { setRunRefusal } from '../../run-refusal';
import { budgetRefusal, monthStart } from '../../budget';

// The agent has no model credential, so a run the budget lets through fails on the
// model rather than calling one. Spend is seeded as the spans the runtime exporter
// writes, the same way agent-analytics.test.ts does.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const columnId = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns[0].id;
  return { asOwner, columnId, teamId: await teamOf(asOwner, 'MKT') };
}

async function createBot(asOwner: Api, monthlyBudgetUsd?: number | null) {
  const res = await createAgent(asOwner, 'MKT', {
    name: 'Bot',
    username: 'bot',
    kind: 'internal',
    ...(monthlyBudgetUsd === undefined ? {} : { monthlyBudgetUsd }),
  });
  return res.data!.agent;
}

async function mentionBot(asOwner: Api, columnId: number) {
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
  ).data!;
  await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'please review @bot' });
  await processAgentRuns();
  const [run] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));
  return run;
}

const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

let nextId = 0;

// openai/gpt-5-mini at 1M input and 500k output tokens costs $1.25.
// A moment of the current month that is already past, also in its first minute.
function thisMonth(): Date {
  return new Date(Math.max(Date.now() - 60 * 1000, monthStart().getTime()));
}

async function seedSpend(meta: Record<string, unknown>, startedAt: Date) {
  await getStore().init();
  const store = (await getStore().getStore('observability'))!;
  const traceId = `budget-trace-${++nextId}`;
  const root = `budget-span-${++nextId}`;
  await store.createSpan({
    span: {
      traceId,
      spanId: root,
      name: 'agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 2000),
      metadata: meta,
    },
  });
  await store.createSpan({
    span: {
      traceId,
      spanId: `budget-span-${++nextId}`,
      parentSpanId: root,
      name: 'inference: 0',
      spanType: SpanType.MODEL_INFERENCE,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 1500),
      attributes: {
        provider: 'openai',
        model: 'gpt-5-mini',
        usage: { inputTokens: 1_000_000, outputTokens: 500_000 },
      },
    },
  });
}

describe('agent monthly budget', () => {
  beforeEach(resetDb);
  afterEach(() => setRunRefusal());

  it('stores the budget on an internal agent and changes it', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createBot(asOwner, 5);
    expect(agent.monthlyBudgetUsd).toBe(5);

    const route = agents(asOwner, teamId)({ agentId: agent.id });
    expect((await route.patch({ monthlyBudgetUsd: 0 })).data).toMatchObject({
      monthlyBudgetUsd: 0,
    });
    expect((await route.patch({ monthlyBudgetUsd: null })).data).toMatchObject({
      monthlyBudgetUsd: null,
    });
  });

  it('rejects a negative budget with 400 and keeps the stored one', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createBot(asOwner, 5);
    const route = agents(asOwner, teamId)({ agentId: agent.id });

    expect((await route.patch({ monthlyBudgetUsd: -1 })).status).toBe(400);
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Other',
      username: 'other',
      kind: 'internal',
      monthlyBudgetUsd: -1,
    });
    expect(res.status).toBe(400);
    expect((await route.get()).data).toMatchObject({ monthlyBudgetUsd: 5 });
  });

  it('stores no budget on an external agent', async () => {
    const { asOwner } = await setup();
    const res = await createAgent(asOwner, 'MKT', {
      name: 'Ext',
      username: 'ext',
      kind: 'external',
      monthlyBudgetUsd: 5,
    });
    expect(res.data!.agent.monthlyBudgetUsd).toBeNull();
  });

  it('fails a queued run of an agent whose budget is spent, without retry', async () => {
    const { asOwner, columnId } = await setup();
    await createBot(asOwner, 0);

    expect(await mentionBot(asOwner, columnId)).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: "The agent's monthly budget of $0.00 is spent",
    });
  });

  it('answers a chat of an agent whose budget is spent with 403', async () => {
    const { asOwner } = await setup();
    const agent = await createBot(asOwner, 0);

    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: agent.id })
      .run.post({ prompt: 'hi' });

    expect(res.status).toBe(403);
    expect(res.error?.value).toMatchObject({
      error: "The agent's monthly budget of $0.00 is spent",
      code: 'run_refused',
    });
  });

  it('does not refuse an agent without a budget', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createBot(asOwner);
    expect(agent.monthlyBudgetUsd).toBeNull();
    expect(await budgetRefusal(teamId, agent.id)).toBeNull();

    expect(await mentionBot(asOwner, columnId)).toMatchObject({
      attempts: 1,
      lastError: 'Agent has no model credential set',
    });
  });

  it("counts only this month's spend against the budget", async () => {
    const { asOwner, teamId } = await setup();
    const projectId = await projectIdOf(asOwner, 'MKT');
    const agent = await createBot(asOwner, 2);
    const meta = { agentId: agent.id, teamId, projectId };

    await seedSpend(meta, new Date(monthStart().getTime() - 24 * 60 * 60 * 1000));
    await seedSpend(meta, thisMonth());
    expect(await budgetRefusal(teamId, agent.id)).toBeNull();

    await seedSpend(meta, thisMonth());
    expect(await budgetRefusal(teamId, agent.id)).toBe(
      "The agent's monthly budget of $2.00 is spent",
    );
  });
});
