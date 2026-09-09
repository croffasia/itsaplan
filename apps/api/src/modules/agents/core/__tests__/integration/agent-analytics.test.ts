import { describe, it, expect, beforeEach } from 'bun:test';
import { SpanType } from '@mastra/core/observability';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { getStore } from '../../runtime/store';

// The agent dashboard:
//   GET /teams/:teamId/agent-analytics       — every agent of the team
//   GET /projects/:projectKey/agent-analytics — the runs that worked in one project
//
// Both read the traces the runtime records, so the spans are seeded the way the
// exporter writes them: a root span for the run carrying the metadata the queries
// scope on, a model call carrying the provider, the model and its token counts, and a
// tool call.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: await teamOf(asOwner, 'MKT') };
}

let nextId = 0;
const spanId = () => `analytics-span-${++nextId}`;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function seedRun(
  traceId: string,
  metadata: Record<string, unknown>,
  startedAt: Date,
  usage: { inputTokens: number; outputTokens: number },
  failed = false,
): Promise<void> {
  const store = (await getStore().getStore('observability'))!;
  const root = spanId();
  await store.createSpan({
    span: {
      traceId,
      spanId: root,
      name: 'agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 2000),
      ...(failed ? { error: { message: 'boom' } } : {}),
      metadata,
    },
  });
  await store.createSpan({
    span: {
      traceId,
      spanId: spanId(),
      parentSpanId: root,
      name: "llm: 'gpt-5-mini'",
      spanType: SpanType.MODEL_GENERATION,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 1500),
      attributes: { provider: 'openai', model: 'gpt-5-mini', usage },
    },
  });
  await store.createSpan({
    span: {
      traceId,
      spanId: spanId(),
      parentSpanId: root,
      name: 'create_issue',
      spanType: SpanType.TOOL_CALL,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 300),
    },
  });
}

const teamDashboard = (api: Api, teamId: number) => api.teams({ teamId })['agent-analytics'];

describe('agent analytics', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('adds up the runs, tokens, cost and tools of the window', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createAgent(asOwner, 'MKT', {
      name: 'Scout',
      username: 'scout',
      kind: 'internal',
    });
    const agentId = agent.data!.agent.id;
    const projectId = await projectIdOf(asOwner, 'MKT');
    const meta = { agentId, teamId, projectId };
    await seedRun('an-1', meta, daysAgo(1), { inputTokens: 1_000_000, outputTokens: 500_000 });
    await seedRun('an-2', meta, daysAgo(2), { inputTokens: 200_000, outputTokens: 0 }, true);
    // Before the window, so it only counts towards what the period is compared against.
    await seedRun('an-old', meta, daysAgo(40), { inputTokens: 10, outputTokens: 10 });

    const res = await teamDashboard(asOwner, teamId).get({ query: { days: 30 } });
    expect(res.status).toBe(200);
    const body = res.data!;
    expect(body.totals).toMatchObject({
      runs: 2,
      errors: 1,
      inputTokens: 1_200_000,
      outputTokens: 500_000,
      toolCalls: 2,
    });
    // openai/gpt-5-mini: 2.5e-7 in, 2e-6 out.
    expect(body.totals.cost).toBeCloseTo(1.2 * 0.25 + 0.5 * 2, 6);
    expect(body.previous.runs).toBe(1);

    expect(body.models).toEqual([
      {
        provider: 'openai',
        model: 'gpt-5-mini',
        calls: 2,
        inputTokens: 1_200_000,
        outputTokens: 500_000,
        cost: body.totals.cost,
      },
    ]);
    expect(body.agents).toMatchObject([{ agentId, name: 'scout', runs: 2, errors: 1 }]);
    expect(body.tools).toEqual([{ name: 'create_issue', calls: 2, errors: 0 }]);
    expect(body.tokensPerDay).toHaveLength(2);
    expect(body.latencyPerDay[0]).toMatchObject({ p50: 2000, p95: 2000 });
  });

  it('reads a window of a day by the hour', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createAgent(asOwner, 'MKT', {
      name: 'Scout',
      username: 'scout',
      kind: 'internal',
    });
    const meta = {
      agentId: agent.data!.agent.id,
      teamId,
      projectId: await projectIdOf(asOwner, 'MKT'),
    };
    const usage = { inputTokens: 100, outputTokens: 100 };
    await seedRun('an-h1', meta, hoursAgo(1), usage);
    // Yesterday by the calendar, still inside the last 24 hours.
    await seedRun('an-h20', meta, hoursAgo(20), usage);
    await seedRun('an-h30', meta, hoursAgo(30), usage);

    const res = await teamDashboard(asOwner, teamId).get({ query: { days: 1 } });
    expect(res.status).toBe(200);
    expect(res.data!.totals.runs).toBe(2);
    expect(res.data!.previous.runs).toBe(1);
    // Both runs of the window sit in an hour bucket of their own.
    expect(res.data!.tokensPerDay).toHaveLength(2);
  });

  it('scopes the project dashboard to that project', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
    const agent = await createAgent(asOwner, 'MKT', {
      name: 'Scout',
      username: 'scout',
      kind: 'internal',
    });
    const agentId = agent.data!.agent.id;
    const mkt = await projectIdOf(asOwner, 'MKT');
    const ops = await projectIdOf(asOwner, 'OPS');
    const usage = { inputTokens: 100, outputTokens: 100 };
    await seedRun('an-mkt', { agentId, teamId, projectId: mkt }, daysAgo(1), usage);
    await seedRun('an-ops', { agentId, teamId, projectId: ops }, daysAgo(1), usage);

    const all = await teamDashboard(asOwner, teamId).get();
    expect(all.data!.totals.runs).toBe(2);

    const scoped = await asOwner.projects({ projectKey: 'MKT' })['agent-analytics'].get();
    expect(scoped.data!.totals.runs).toBe(1);
  });

  it('opens the team dashboard to a manager and closes it to a member', async () => {
    const { asOwner, teamId } = await setup();
    const role = await createRole(asOwner, 'MKT', {
      name: 'Analyst',
      permissions: { agent_analytics: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    // The team dashboard follows the rank in the team, which a project role does not give.
    expect((await teamDashboard(asMember, teamId).get()).status).toBe(403);

    // The project dashboard follows the role matrix, and this role grants it.
    const scoped = await asMember.projects({ projectKey: 'MKT' })['agent-analytics'].get();
    expect(scoped.status).toBe(200);
  });

  it('refuses the project dashboard to a member whose role does not grant it', async () => {
    const { asOwner } = await setup();
    const role = await createRole(asOwner, 'MKT', {
      name: 'Plain',
      permissions: { work_items: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    const res = await asMember.projects({ projectKey: 'MKT' })['agent-analytics'].get();
    expect(res.status).toBe(403);
  });
});
