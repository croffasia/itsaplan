import { beforeEach, describe, expect, it } from 'bun:test';
import { SpanType } from '@mastra/core/observability';
import { apiKeyApi, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { getStore } from '#modules/agents/core/runtime/store';

async function setup() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await createProject(api, { key: 'RUN', name: 'Runs' });
  const project = (await api.projects({ projectKey: 'RUN' }).get()).data!;
  const agent = (
    await createAgent(api, 'RUN', {
      name: 'Reviewer',
      username: 'reviewer',
      kind: 'internal',
    })
  ).data!.agent;
  const issue = (
    await api.projects({ projectKey: 'RUN' }).issues.post({
      title: 'Review this',
      columnId: project.columns[0].id,
    })
  ).data!;
  await api.issues({ issueId: issue.id }).comments.post({ body: '@reviewer review this' });
  return { api, issue, agent };
}

async function seedTrace(traceId: string, metadata: Record<string, unknown>, startedAt: Date) {
  await getStore().init();
  const store = (await getStore().getStore('observability'))!;
  await store.createSpan({
    span: {
      traceId,
      spanId: `${traceId}-root`,
      name: 'Review',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 100),
      input: 'Review this',
      output: 'Reviewed',
      metadata,
    },
  });
  await store.createSpan({
    span: {
      traceId,
      spanId: `${traceId}-tool`,
      parentSpanId: `${traceId}-root`,
      name: 'get_issue',
      spanType: SpanType.TOOL_CALL,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 50),
      input: { issueId: metadata.issueId },
      output: { title: 'Review this' },
    },
  });
}

describe('issue agent runs', () => {
  beforeEach(resetDb);

  it('pages only the requested issue, newest first', async () => {
    const { api, issue, agent } = await setup();
    await api.issues({ issueId: issue.id }).comments.post({ body: '@reviewer another review' });
    const project = (await api.projects({ projectKey: 'RUN' }).get()).data!;
    const other = (
      await api.projects({ projectKey: 'RUN' }).issues.post({
        title: 'Other',
        columnId: project.columns[0].id,
      })
    ).data!;
    await api.issues({ issueId: other.id }).comments.post({ body: '@reviewer unrelated' });
    const route = api.issues({ issueId: issue.id })['agent-runs'];
    const first = await route.get({ query: { limit: 1 } });
    expect(first.status).toBe(200);
    expect(first.data!.items).toHaveLength(1);
    expect(first.data!.items[0]).toMatchObject({
      agentId: agent.id,
      username: 'reviewer',
      status: 'pending',
      attempts: 0,
      output: null,
      lastError: null,
      startedAt: null,
      finishedAt: null,
    });
    expect(first.data!.items[0].prompt).toContain('another review');
    const second = await route.get({ query: { limit: 1, before: first.data!.nextCursor! } });
    expect(second.data!.items).toHaveLength(1);
    expect(second.data!.items[0].prompt).toContain('review this');
    expect(second.data!.items[0].id).toBeLessThan(first.data!.items[0].id);
    expect(second.data!.nextCursor).toBeNull();
  });

  it('requires both work item and agent read access', async () => {
    const { api, issue } = await setup();
    const run = (await api.issues({ issueId: issue.id })['agent-runs'].get()).data!.items[0];
    for (const permissions of [{ work_items: { read: true } }, { ai_agents: { read: true } }]) {
      const role = await createRole(api, 'RUN', { name: JSON.stringify(permissions), permissions });
      const member = await addProjectMember(api, 'RUN', role.data!.id);
      expect((await member.issues({ issueId: issue.id })['agent-runs'].get()).status).toBe(403);
      const trace = await member
        .issues({ issueId: issue.id })
        ['agent-runs']({ runId: run.id })
        .trace.get();
      expect(trace.status).toBe(403);
    }
    const role = await createRole(api, 'RUN', {
      name: 'Run reader',
      permissions: { work_items: { read: true }, ai_agents: { read: true } },
    });
    const member = await addProjectMember(api, 'RUN', role.data!.id);
    expect((await member.issues({ issueId: issue.id })['agent-runs'].get()).status).toBe(200);
  });

  it('rejects missing issues and invalid page bounds', async () => {
    const { api, issue } = await setup();
    expect((await api.issues({ issueId: issue.id + 1000 })['agent-runs'].get()).status).toBe(404);
    for (const limit of [0, 51, 1.5]) {
      const response = await api
        .issues({ issueId: issue.id })
        ['agent-runs'].get({ query: { limit } });
      expect(response.status).toBe(400);
    }
  });

  it('does not show prompts from the former project of a moved issue', async () => {
    const { api, issue } = await setup();
    const run = (await api.issues({ issueId: issue.id })['agent-runs'].get()).data!.items[0];
    const target = (await createProject(api, { key: 'NEXT', name: 'Next' })).data!;
    const moved = await api.issues({ issueId: issue.id }).move.post({ projectId: target.id });
    expect(moved.status).toBe(200);
    const route = api.issues({ issueId: issue.id })['agent-runs'];
    expect((await route.get()).data).toEqual({ items: [], nextCursor: null });
    expect((await route({ runId: run.id }).trace.get()).status).toBe(404);
  });

  it('returns no trace before one is recorded and rejects an unrelated run', async () => {
    const { api, issue } = await setup();
    const route = api.issues({ issueId: issue.id })['agent-runs'];
    const run = (await route.get()).data!.items[0];
    const trace = await route({ runId: run.id }).trace.get();
    expect(trace.status).toBe(200);
    expect(trace.data).toBeNull();
    expect((await route({ runId: run.id + 1000 }).trace.get()).status).toBe(404);
  });

  it('opens the latest recorded attempt with its tool input and output', async () => {
    const { api, issue, agent } = await setup();
    const route = api.issues({ issueId: issue.id })['agent-runs'];
    const run = (await route.get()).data!.items[0];
    const metadata = {
      agentId: agent.id,
      runId: run.id,
      issueId: issue.id,
      projectId: issue.projectId,
    };
    await seedTrace('issue-run-old', metadata, new Date('2026-01-01T00:00:00Z'));
    await seedTrace('issue-run-latest', metadata, new Date('2026-01-02T00:00:00Z'));
    await seedTrace(
      'issue-run-private',
      { ...metadata, userId: 'another-person' },
      new Date('2026-01-03T00:00:00Z'),
    );
    const trace = await route({ runId: run.id }).trace.get();
    expect(trace.status).toBe(200);
    expect(trace.data!.trace.traceId).toBe('issue-run-latest');
    expect(trace.data!.previousTraceId).toBe('issue-run-old');
    const earlier = await route({ runId: run.id }).trace.get({
      query: { traceId: trace.data!.previousTraceId! },
    });
    expect(earlier.data!.trace.traceId).toBe('issue-run-old');
    expect(earlier.data!.previousTraceId).toBeNull();
    const privateTrace = await route({ runId: run.id }).trace.get({
      query: { traceId: 'issue-run-private' },
    });
    expect(privateTrace.status).toBe(404);
    const missingTrace = await route({ runId: run.id }).trace.get({
      query: { traceId: 'missing' },
    });
    expect(missingTrace.status).toBe(404);
    expect(trace.data!.spans).toContainEqual(
      expect.objectContaining({
        name: 'get_issue',
        input: { issueId: issue.id },
        output: { title: 'Review this' },
      }),
    );
  });

  it('rejects traces of another issue, project or run', async () => {
    const { api, issue, agent } = await setup();
    const route = api.issues({ issueId: issue.id })['agent-runs'];
    const run = (await route.get()).data!.items[0];
    const metadata = {
      agentId: agent.id,
      runId: run.id,
      issueId: issue.id,
      projectId: issue.projectId,
    };
    for (const [traceId, otherScope] of [
      ['other-issue', { issueId: issue.id + 1000 }],
      ['other-project', { projectId: issue.projectId + 1000 }],
      ['other-run', { runId: run.id + 1000 }],
    ] as const) {
      await seedTrace(traceId, { ...metadata, ...otherScope }, new Date());
      const trace = await route({ runId: run.id }).trace.get({ query: { traceId } });
      expect(trace.status).toBe(404);
    }
    expect((await route({ runId: run.id }).trace.get()).data).toBeNull();
  });

  it('orders attempts with equal start times without repeating the cursor', async () => {
    const { api, issue, agent } = await setup();
    const route = api.issues({ issueId: issue.id })['agent-runs'];
    const run = (await route.get()).data!.items[0];
    const metadata = {
      agentId: agent.id,
      runId: run.id,
      issueId: issue.id,
      projectId: issue.projectId,
    };
    const startedAt = new Date('2026-01-01T00:00:00Z');
    await seedTrace('attempt-a', metadata, startedAt);
    await seedTrace('attempt-z', metadata, startedAt);
    const latest = await route({ runId: run.id }).trace.get();
    expect(latest.data!.trace.traceId).toBe('attempt-z');
    expect(latest.data!.previousTraceId).toBe('attempt-a');
    const previous = await route({ runId: run.id }).trace.get({ query: { traceId: 'attempt-a' } });
    expect(previous.data!.trace.traceId).toBe('attempt-a');
    expect(previous.data!.previousTraceId).toBeNull();
  });

  it('shows the output and error reported by an external runner', async () => {
    const { api, issue } = await setup();
    const created = await createAgent(api, 'RUN', {
      name: 'External',
      username: 'external',
      kind: 'external',
      triggerOnMention: true,
    });
    const runner = apiKeyApi(created.data!.apiKey!);
    for (const status of ['success', 'failed'] as const) {
      await api.issues({ issueId: issue.id }).comments.post({ body: '@external review this' });
      const run = (await runner['agent-runs'].claim.post()).data!.run!;
      await runner['agent-runs']({ runId: run.id }).result.post({
        status,
        output: 'Review output',
        error: status === 'failed' ? 'Command exited with 1' : undefined,
      });
      const history = (await api.issues({ issueId: issue.id })['agent-runs'].get()).data!;
      expect(history.items[0]).toMatchObject({
        id: run.id,
        kind: 'external',
        status,
        output: 'Review output',
        lastError: status === 'failed' ? 'Command exited with 1' : null,
        attempts: 1,
      });
      expect(history.items[0].startedAt).not.toBeNull();
      expect(history.items[0].finishedAt).not.toBeNull();
    }
  });
});
