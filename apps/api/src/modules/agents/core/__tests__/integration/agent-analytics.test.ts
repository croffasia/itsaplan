import { describe, it, expect, beforeEach } from 'bun:test';
import { SpanType } from '@mastra/core/observability';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { getStore } from '../../runtime/store';

// The agent dashboard, GET /teams/:teamId/agent-analytics and the same over a
// workspace, GET /workspaces/:workspaceId/agent-analytics. It reads the traces the
// runtime records, so the spans are seeded the way the exporter writes them: a root
// span for the run carrying the metadata the queries scope on, a model call carrying
// the provider, the model and its token counts, and a tool call, which counts for
// nothing here.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: await teamOf(asOwner, 'MKT') };
}

async function createScout(asOwner: Api) {
  const res = await createAgent(asOwner, 'MKT', {
    name: 'Scout',
    username: 'scout',
    kind: 'internal',
  });
  return res.data!.agent.id;
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
  await getStore().init();
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
      name: 'inference: 0',
      spanType: SpanType.MODEL_INFERENCE,
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
const workspaceDashboard = (api: Api, workspaceId: number) =>
  api.workspaces({ workspaceId })['agent-analytics'];

async function ownWorkspaceId(api: Api): Promise<number> {
  return (await api.workspaces.get()).data!.find((one) => one.role === 'owner')!.id;
}

describe('agent analytics', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('adds up the runs, tokens and cost of the window', async () => {
    const { asOwner, teamId } = await setup();
    const agentId = await createScout(asOwner);
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
    });
    // openai/gpt-5-mini: 2.5e-7 in, 2e-6 out.
    expect(body.totals.cost).toBeCloseTo(1.2 * 0.25 + 0.5 * 2, 6);
    expect(body.previous).toMatchObject({ runs: 1, inputTokens: 10, outputTokens: 10 });

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
    expect(body.agents).toMatchObject([{ agentId, name: 'Scout', runs: 2, errors: 1 }]);
    expect(body.projects).toMatchObject([{ projectId, name: 'Marketing', runs: 2, errors: 1 }]);
    expect(body.teams).toMatchObject([{ teamId, runs: 2, errors: 1 }]);
    expect(body.tokensPerDay).toHaveLength(2);
  });

  it('splits the window by project', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
    const agentId = await createScout(asOwner);
    const mkt = await projectIdOf(asOwner, 'MKT');
    const ops = await projectIdOf(asOwner, 'OPS');
    await seedRun('an-mkt', { agentId, teamId, projectId: mkt }, daysAgo(1), {
      inputTokens: 300,
      outputTokens: 0,
    });
    await seedRun('an-ops', { agentId, teamId, projectId: ops }, daysAgo(1), {
      inputTokens: 100,
      outputTokens: 0,
    });

    const res = await teamDashboard(asOwner, teamId).get();
    expect(res.data!.projects.map((p) => [p.name, p.inputTokens])).toEqual([
      ['Marketing', 300],
      ['Operations', 100],
    ]);
  });

  it('narrows the window to one project', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
    const agentId = await createScout(asOwner);
    const mkt = await projectIdOf(asOwner, 'MKT');
    const ops = await projectIdOf(asOwner, 'OPS');
    const usage = { inputTokens: 100, outputTokens: 0 };
    await seedRun('an-mkt', { agentId, teamId, projectId: mkt }, daysAgo(1), usage);
    await seedRun('an-ops', { agentId, teamId, projectId: ops }, daysAgo(1), usage);

    const res = await teamDashboard(asOwner, teamId).get({ query: { projectId: ops } });
    expect(res.data!.totals.runs).toBe(1);
    expect(res.data!.projects.map((p) => p.name)).toEqual(['Operations']);
    expect(res.data!.readableProjects.map((p) => p.name)).toEqual(['Marketing', 'Operations']);
  });

  it('reads a window of a day by the hour', async () => {
    const { asOwner, teamId } = await setup();
    const meta = {
      agentId: await createScout(asOwner),
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

  it('counts a run of the first day of the window in the window', async () => {
    const { asOwner, teamId } = await setup();
    const meta = {
      agentId: await createScout(asOwner),
      teamId,
      projectId: await projectIdOf(asOwner, 'MKT'),
    };
    // A minute after the window opens, in a day bucket that starts before it.
    const startedAt = new Date(daysAgo(30).getTime() + 60_000);
    await seedRun('an-edge', meta, startedAt, { inputTokens: 100, outputTokens: 100 });

    const res = await teamDashboard(asOwner, teamId).get({ query: { days: 30 } });
    expect(res.data!.totals).toMatchObject({ runs: 1, inputTokens: 100 });
    expect(res.data!.previous).toMatchObject({ runs: 0, inputTokens: 0 });
  });

  it("leaves out another team's runs", async () => {
    const { asOwner, teamId } = await setup();
    const meta = { agentId: await createScout(asOwner), projectId: 1 };
    await seedRun('an-other', { ...meta, teamId: teamId + 1000 }, daysAgo(1), {
      inputTokens: 100,
      outputTokens: 100,
    });

    const res = await teamDashboard(asOwner, teamId).get();
    expect(res.data!.totals.runs).toBe(0);
  });

  it('closes the dashboard to a member whose role does not grant usage', async () => {
    const { asOwner, teamId } = await setup();
    const role = await createRole(asOwner, 'MKT', {
      name: 'Agent handler',
      permissions: { ai_agents: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    expect((await teamDashboard(asMember, teamId).get()).status).toBe(403);
  });

  it('shows a member with usage only the projects where their role grants it', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
    const agentId = await createScout(asOwner);
    const usage = { inputTokens: 100, outputTokens: 0 };
    const mkt = await projectIdOf(asOwner, 'MKT');
    const ops = await projectIdOf(asOwner, 'OPS');
    await seedRun('an-mkt', { agentId, teamId, projectId: mkt }, daysAgo(1), usage);
    await seedRun('an-ops', { agentId, teamId, projectId: ops }, daysAgo(1), usage);
    const role = await createRole(asOwner, 'MKT', {
      name: 'Spend watcher',
      permissions: { agent_usage: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    const res = await teamDashboard(asMember, teamId).get();
    expect(res.status).toBe(200);
    expect(res.data!.totals.runs).toBe(1);
    expect(res.data!.projects.map((p) => p.name)).toEqual(['Marketing']);
    expect(res.data!.readableProjects.map((p) => p.name)).toEqual(['Marketing']);
    const other = await teamDashboard(asMember, teamId).get({ query: { projectId: ops } });
    expect(other.data!.totals.runs).toBe(0);
  });

  it('reads every team of the workspace and compares them', async () => {
    const { asOwner, teamId } = await setup();
    const ops = (await asOwner.teams.post({ name: 'Ops', slug: 'ops' })).data!;
    const meta = {
      agentId: await createScout(asOwner),
      projectId: await projectIdOf(asOwner, 'MKT'),
    };
    await seedRun('ws-mkt', { ...meta, teamId }, daysAgo(1), { inputTokens: 300, outputTokens: 0 });
    await seedRun('ws-ops', { ...meta, teamId: ops.id }, daysAgo(1), {
      inputTokens: 100,
      outputTokens: 0,
    });
    await seedRun('ws-other', { ...meta, teamId: teamId + 1000 }, daysAgo(1), {
      inputTokens: 999,
      outputTokens: 0,
    });

    const res = await workspaceDashboard(asOwner, await ownWorkspaceId(asOwner)).get({
      query: { days: 30 },
    });
    expect(res.status).toBe(200);
    expect(res.data!.totals).toMatchObject({ runs: 2, inputTokens: 400 });
    expect(res.data!.teams.map((row) => [row.teamId, row.inputTokens])).toEqual([
      [teamId, 300],
      [ops.id, 100],
    ]);
    expect(res.data!.teams[1]!.name).toBe('Ops');
  });

  it('closes the workspace dashboard to somebody who only works in a team of it', async () => {
    const { asOwner } = await setup();
    const role = await createRole(asOwner, 'MKT', {
      name: 'Spend watcher',
      permissions: { agent_usage: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    const res = await workspaceDashboard(asMember, await ownWorkspaceId(asOwner)).get();
    expect(res.status).toBe(404);
  });
});
