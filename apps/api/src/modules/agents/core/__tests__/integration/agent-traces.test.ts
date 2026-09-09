import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SpanType } from '@mastra/core/observability';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { getStore } from '../../runtime/store';
import { pruneAgentTraces } from '../../runtime/trace-retention';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { setAgentSettings } from '#modules/settings/service';

// The trace endpoints:
//   GET /teams/:teamId/ai-agents/:agentId/traces            — the traces of its runs
//   GET /teams/:teamId/ai-agents/:agentId/traces/:traceId   — one trace with its spans
//
// A trace is written by the runtime through Mastra (see runtime/observability), which
// needs a live model call, so the spans are seeded straight into the store the way the
// exporter writes them: a root span for the run carrying the metadata the endpoints
// filter on, and a child span for a tool call.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: await teamOf(asOwner, 'MKT') };
}

const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

async function createInternalAgent(asOwner: Api, name: string, username: string) {
  const res = await createAgent(asOwner, 'MKT', { name, username, kind: 'internal' });
  return res.data!.agent;
}

let nextId = 0;
const spanId = () => `span-${++nextId}`;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function seedTrace(
  traceId: string,
  metadata: Record<string, unknown>,
  startedAt: Date,
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
      endedAt: new Date(startedAt.getTime() + 1500),
      input: 'do the thing',
      output: 'done',
      metadata,
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
      startedAt: new Date(startedAt.getTime() + 100),
      endedAt: new Date(startedAt.getTime() + 400),
      input: { title: 'Task' },
      output: { id: 7 },
    },
  });
}

describe('agent traces', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("lists the agent's traces newest first, with what each run belongs to", async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Scout', 'scout');
    const projectId = await projectIdOf(asOwner, 'MKT');
    await seedTrace(
      'trace-old',
      { agentId: agent.id, teamId, projectId, runId: 11, trigger: 'mention', issueId: 3 },
      new Date('2026-01-01T10:00:00Z'),
    );
    await seedTrace(
      'trace-new',
      { agentId: agent.id, teamId, projectId },
      new Date('2026-01-02T10:00:00Z'),
    );

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).traces.get();
    expect(res.status).toBe(200);
    expect(res.data!.total).toBe(2);
    expect(res.data!.items.map((t) => t.traceId)).toEqual(['trace-new', 'trace-old']);
    expect(res.data!.items[1]).toMatchObject({
      status: 'success',
      durationMs: 1500,
      projectId,
      runId: 11,
      trigger: 'mention',
      issueId: 3,
    });
    // A chat run is queued nowhere, so its trace names no run.
    expect(res.data!.items[0]).toMatchObject({ runId: null, trigger: null });
  });

  it('reads one trace with its steps, and not one of another agent', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Scout', 'scout');
    const other = await createInternalAgent(asOwner, 'Guide', 'guide');
    const projectId = await projectIdOf(asOwner, 'MKT');
    await seedTrace(
      'trace-1',
      { agentId: agent.id, teamId, projectId },
      new Date('2026-01-01T10:00:00Z'),
    );

    const res = await agents(
      asOwner,
      teamId,
    )({ agentId: agent.id })
      .traces({
        traceId: 'trace-1',
      })
      .get();
    expect(res.status).toBe(200);
    expect(res.data!.trace.traceId).toBe('trace-1');
    expect(res.data!.spans.map((s) => s.type)).toEqual(['agent_run', 'tool_call']);
    expect(res.data!.spans[1]).toMatchObject({
      name: 'create_issue',
      durationMs: 300,
      input: { title: 'Task' },
      output: { id: 7 },
    });

    const wrong = await agents(
      asOwner,
      teamId,
    )({ agentId: other.id })
      .traces({
        traceId: 'trace-1',
      })
      .get();
    expect(wrong.status).toBe(404);
  });

  it('gives a member only the traces of a project they belong to', async () => {
    const { asOwner, teamId } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
    const agent = await createInternalAgent(asOwner, 'Scout', 'scout');
    const mkt = await projectIdOf(asOwner, 'MKT');
    const ops = await projectIdOf(asOwner, 'OPS');
    await agents(asOwner, teamId)({ agentId: agent.id }).projects.put({ projectIds: [mkt, ops] });
    await seedTrace('trace-mkt', { agentId: agent.id, teamId, projectId: mkt }, new Date());
    await seedTrace('trace-ops', { agentId: agent.id, teamId, projectId: ops }, new Date());

    const role = await createRole(asOwner, 'MKT', {
      name: 'Agent handler',
      permissions: { ai_agents: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    // The owner runs the team, so both projects are theirs.
    const all = await agents(asOwner, teamId)({ agentId: agent.id }).traces.get();
    expect(all.data!.total).toBe(2);

    // The member reads one project at a time, and only one they are in.
    const unscoped = await agents(asMember, teamId)({ agentId: agent.id }).traces.get();
    expect(unscoped.status).toBe(403);

    const theirs = await agents(
      asMember,
      teamId,
    )({ agentId: agent.id }).traces.get({
      query: { projectId: mkt },
    });
    expect(theirs.data!.items.map((t) => t.traceId)).toEqual(['trace-mkt']);

    const refused = await agents(
      asMember,
      teamId,
    )({ agentId: agent.id }).traces.get({
      query: { projectId: ops },
    });
    expect(refused.status).toBe(403);

    const hidden = await agents(
      asMember,
      teamId,
    )({ agentId: agent.id })
      .traces({
        traceId: 'trace-ops',
      })
      .get();
    expect(hidden.status).toBe(403);
  });
});

// The sweep the worker calls on its own interval. The window is the instance setting
// unless the instance gives the team its own, and a trace whose team is gone goes
// whatever the window says.
describe('agent trace retention', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    clearLimits();
  });

  async function seedAged(asOwner: Api, teamId: number, agentId: number) {
    const projectId = await projectIdOf(asOwner, 'MKT');
    const meta = { agentId, teamId, projectId };
    await seedTrace('trace-old', meta, daysAgo(40));
    await seedTrace('trace-recent', meta, daysAgo(5));
  }

  const traceIds = async (asOwner: Api, teamId: number, agentId: number) => {
    const res = await agents(asOwner, teamId)({ agentId }).traces.get();
    return res.data!.items.map((t) => t.traceId);
  };

  it('deletes the traces past the instance window and keeps the rest', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Scout', 'scout');
    await seedAged(asOwner, teamId, agent.id);
    await setAgentSettings({ traceRetentionDays: 30 });

    expect(await pruneAgentTraces()).toBeGreaterThan(0);

    expect(await traceIds(asOwner, teamId, agent.id)).toEqual(['trace-recent']);
  });

  it('keeps every trace when the instance keeps them all', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Scout', 'scout');
    await seedAged(asOwner, teamId, agent.id);
    await setAgentSettings({ traceRetentionDays: 0 });

    await pruneAgentTraces();

    expect(await traceIds(asOwner, teamId, agent.id)).toEqual(['trace-recent', 'trace-old']);
  });

  it("uses the team's own window over the instance one", async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Scout', 'scout');
    await seedAged(asOwner, teamId, agent.id);
    await setAgentSettings({ traceRetentionDays: 0 });
    setLimits({ maxTraceRetentionDays: 30 });

    await pruneAgentTraces();

    expect(await traceIds(asOwner, teamId, agent.id)).toEqual(['trace-recent']);
  });

  it('drops the traces of a team that no longer exists', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Scout', 'scout');
    const projectId = await projectIdOf(asOwner, 'MKT');
    await seedTrace(
      'trace-orphan',
      { agentId: agent.id, teamId: teamId + 1000, projectId },
      new Date(),
    );
    await seedTrace('trace-mine', { agentId: agent.id, teamId, projectId }, new Date());

    await pruneAgentTraces();

    expect(await traceIds(asOwner, teamId, agent.id)).toEqual(['trace-mine']);
  });
});
