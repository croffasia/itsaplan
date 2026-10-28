import { beforeEach, describe, expect, it } from 'bun:test';
import { SpanType } from '@mastra/core/observability';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { getStore } from '#modules/agents/core/runtime/store';

// The steps of an internal agent's run, read from the runner queue by the run alone, so
// a run on no issue, such as a schedule's, opens as well.

async function setup() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await createProject(api, { key: 'RUN', name: 'Runs' });
  const agent = (await createAgent(api, 'RUN', { name: 'Bot', username: 'bot', kind: 'internal' }))
    .data!.agent;
  const schedule = (
    await api.projects({ projectKey: 'RUN' })['agent-schedules'].post({
      agentId: agent.id,
      name: 'Daily',
      cron: '0 9 * * *',
      prompt: 'Daily work',
    })
  ).data!;
  const runId = (
    await api
      .projects({ projectKey: 'RUN' })
      ['agent-schedules']({ scheduleId: schedule.id })
      .run.post()
  ).data!.runId;
  const metadata = { agentId: agent.id, runId, projectId: agent.projects[0].id };
  const trace = (who = api) => who['agent-runs']({ runId })['internal-trace'];
  return { api, metadata, trace };
}

async function seedTrace(traceId: string, metadata: Record<string, unknown>, startedAt: Date) {
  await getStore().init();
  const store = (await getStore().getStore('observability'))!;
  await store.createSpan({
    span: {
      traceId,
      spanId: `${traceId}-root`,
      name: 'Daily',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 100),
      input: 'Daily work',
      output: 'Done',
      metadata,
    },
  });
}

describe('internal run trace', () => {
  beforeEach(resetDb);

  it('opens the latest attempt of a run on no issue, linked to the one before', async () => {
    const { metadata, trace } = await setup();
    await seedTrace('daily-old', metadata, new Date('2026-01-01T00:00:00Z'));
    await seedTrace('daily-latest', metadata, new Date('2026-01-02T00:00:00Z'));

    const latest = await trace().get();
    expect(latest.status).toBe(200);
    expect(latest.data).toMatchObject({
      trace: { traceId: 'daily-latest' },
      previousTraceId: 'daily-old',
    });
    const earlier = await trace().get({ query: { traceId: 'daily-old' } });
    expect(earlier.data).toMatchObject({ trace: { traceId: 'daily-old' }, previousTraceId: null });
    expect((await trace().get({ query: { traceId: 'missing' } })).status).toBe(404);
  });

  it('answers null until a trace of that run is recorded', async () => {
    const { metadata, trace } = await setup();
    await seedTrace('other-run', { ...metadata, runId: metadata.runId + 1 }, new Date());
    await seedTrace('on-an-issue', { ...metadata, issueId: 1 }, new Date());

    const res = await trace().get();
    expect(res.status).toBe(200);
    expect(res.data).toBeNull();
  });

  it('takes reading both work items and agents in the run project', async () => {
    const { api, trace } = await setup();
    const agentsOnly = (
      await createRole(api, 'RUN', { name: 'Agents', permissions: { ai_agents: { read: true } } })
    ).data!;
    const both = (
      await createRole(api, 'RUN', {
        name: 'Both',
        permissions: { ai_agents: { read: true }, work_items: { read: true } },
      })
    ).data!;

    expect((await trace(await addProjectMember(api, 'RUN', both.id)).get()).status).toBe(200);
    expect((await trace(await addProjectMember(api, 'RUN', agentsOnly.id)).get()).status).toBe(403);
    expect((await api['agent-runs']({ runId: 999999 })['internal-trace'].get()).status).toBe(404);
  });
});
