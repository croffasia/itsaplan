import { beforeEach, describe, expect, it } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, apiKeyApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';

const sessionId = '0199a213-81c0-7800-8aa1-bbab2a035a53';
const events = [
  { type: 'TOOL_CALL_START' as const, toolCallId: 'tool-1', toolCallName: 'shell' },
  { type: 'TOOL_CALL_ARGS' as const, toolCallId: 'tool-1', delta: 'ls' },
  { type: 'TOOL_CALL_RESULT' as const, toolCallId: 'tool-1', messageId: 'm', content: 'README.md' },
];
async function setup() {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await api.projects.post({ key: 'RUN', name: 'Runs' });
  const project = (await api.projects({ projectKey: 'RUN' }).get()).data!;
  const created = (
    await createAgent(api, 'RUN', {
      name: 'Runner',
      username: 'runner',
      kind: 'external',
      triggerOnMention: true,
    })
  ).data!;
  const runner = apiKeyApi(created.apiKey!);
  const issue = (
    await api
      .projects({ projectKey: 'RUN' })
      .issues.post({ title: 'Record tools', columnId: project.columns[0].id })
  ).data!;
  await api.issues({ issueId: issue.id }).comments.post({ body: '@runner inspect' });
  const run = (await runner['agent-runs'].claim.post()).data!.run!;
  return { api, runner, run, issue, project, created };
}

describe('external run events', () => {
  beforeEach(resetDb);

  it('records live events and a Codex link, and retains them after completion', async () => {
    const { api, runner, run } = await setup();
    const route = api['agent-runs']({ runId: run.id }).trace;
    expect((await route.get()).data).toBeNull();
    const marker = (await api.sync.rev.get({ query: { scopes: 'runnerQueue:1' } })).data!.revs[
      'runnerQueue:1'
    ];
    const write = await runner['agent-runs']({ runId: run.id }).events.post({
      attempt: 1,
      offset: 0,
      events,
      sessionId,
    });
    expect(write.status).toBe(200);
    expect(write.data).toEqual({ nextOffset: 3, truncated: false });
    expect(
      (await api.sync.rev.get({ query: { scopes: 'runnerQueue:1' } })).data!.revs['runnerQueue:1'],
    ).not.toBe(marker);
    const trace = (await route.get()).data!;
    expect(trace.sessionUrl).toBe(`codex://threads/${sessionId}`);
    expect(trace.events.map((e) => e.event)).toEqual(events);
    await runner['agent-runs']({ runId: run.id }).result.post({ status: 'success' });
    expect((await route.get()).data).toEqual(trace);
    expect(
      (await runner['agent-runs']({ runId: run.id }).events.post({ attempt: 1, offset: 3, events }))
        .status,
    ).toBe(404);
  }, 20_000);

  it('deduplicates accepted batches and rejects gaps and changed session ids', async () => {
    const { api, runner, run } = await setup();
    const route = runner['agent-runs']({ runId: run.id }).events;
    const batch = { attempt: 1, offset: 0, events, sessionId };
    await route.post(batch);
    expect((await route.post(batch)).data).toEqual({ nextOffset: 3, truncated: false });
    expect((await route.post({ ...batch, offset: 5 })).status).toBe(409);
    expect(
      (await route.post({ ...batch, offset: 3, sessionId: '0199a213-81c0-7800-8aa1-bbab2a035a54' }))
        .status,
    ).toBe(409);
    expect(
      (await route.post({ ...batch, offset: 3, sessionId: 'javascript:alert(1)' })).status,
    ).toBe(400);
    expect((await api['agent-runs']({ runId: run.id }).trace.get()).data!.events).toHaveLength(3);
  }, 20_000);

  it('separates retries and refuses events from an expired or older attempt', async () => {
    const { api, runner, run } = await setup();
    const write = runner['agent-runs']({ runId: run.id }).events;
    await write.post({ attempt: 1, offset: 0, events, sessionId });
    await db
      .update(agentRun)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(agentRun.id, run.id));
    expect((await write.post({ attempt: 1, offset: 3, events })).status).toBe(404);
    expect((await runner['agent-runs'].claim.post()).data!.run!.attempts).toBe(2);
    expect((await write.post({ attempt: 1, offset: 3, events })).status).toBe(404);
    expect(
      (await runner['agent-runs']({ runId: run.id }).heartbeat.post({ attempt: 1 })).status,
    ).toBe(404);
    expect(
      (await runner['agent-runs']({ runId: run.id }).result.post({ status: 'success', attempt: 1 }))
        .status,
    ).toBe(404);
    expect(
      (await runner['agent-runs']({ runId: run.id }).heartbeat.post({ attempt: 2 })).status,
    ).toBe(204);
    await write.post({ attempt: 2, offset: 0, events });
    const route = api['agent-runs']({ runId: run.id }).trace;
    expect((await route.get()).data).toMatchObject({
      attempt: 2,
      previousAttempt: 1,
      sessionId: null,
    });
    expect((await route.get({ query: { attempt: 1 } })).data!.sessionId).toBe(sessionId);
    expect((await route.get({ query: { attempt: 3 } })).status).toBe(404);
  }, 20_000);

  it('requires both read permissions and hides traces after an issue moves', async () => {
    const { api, runner, run, issue } = await setup();
    await runner['agent-runs']({ runId: run.id }).events.post({ attempt: 1, offset: 0, events });
    for (const permissions of [{ work_items: { read: true } }, { ai_agents: { read: true } }]) {
      const role = (
        await createRole(api, 'RUN', { name: JSON.stringify(permissions), permissions })
      ).data!;
      const member = await addProjectMember(api, 'RUN', role.id);
      expect((await member['agent-runs']({ runId: run.id }).trace.get()).status).toBe(403);
    }
    const other = (await api.projects.post({ key: 'NEXT', name: 'Next' })).data!;
    await api.issues({ issueId: issue.id }).move.post({ projectId: other.id });
    expect((await api['agent-runs']({ runId: run.id }).trace.get()).status).toBe(404);
  }, 20_000);

  it('refuses another runner and bounds stored events without stopping the run', async () => {
    const { api, runner, run } = await setup();
    const other = (
      await createAgent(api, 'RUN', { name: 'Other', username: 'other', kind: 'external' })
    ).data!;
    expect(
      (
        await apiKeyApi(other.apiKey!)
          ['agent-runs']({ runId: run.id })
          .events.post({ attempt: 1, offset: 0, events })
      ).status,
    ).toBe(404);
    const large = Array.from({ length: 40 }, () => ({
      type: 'TOOL_CALL_ARGS' as const,
      toolCallId: 'tool',
      delta: 'x'.repeat(32000),
    }));
    const ack = await runner['agent-runs']({ runId: run.id }).events.post({
      attempt: 1,
      offset: 0,
      events: large,
    });
    expect(ack.data).toEqual({ nextOffset: 40, truncated: true });
    const trace = (await api['agent-runs']({ runId: run.id }).trace.get()).data!;
    expect(JSON.stringify(trace.events).length).toBeLessThan(1_000_000);
    expect(
      (await runner['agent-runs']({ runId: run.id }).result.post({ status: 'success' })).status,
    ).toBe(204);
  }, 20_000);

  it('retains the trace of a manual scheduled run without an issue', async () => {
    const { api, runner, run, created } = await setup();
    await runner['agent-runs']({ runId: run.id }).result.post({ status: 'success' });
    const schedule = (
      await api.projects({ projectKey: 'RUN' })['agent-schedules'].post({
        agentId: created.agent.id,
        name: 'Manual',
        cron: '0 9 * * *',
        prompt: 'Inspect files',
      })
    ).data!;
    await api
      .projects({ projectKey: 'RUN' })
      ['agent-schedules']({ scheduleId: schedule.id })
      .run.post();
    const manual = (await runner['agent-runs'].claim.post()).data!.run!;
    expect(manual.issueId).toBeNull();
    await runner['agent-runs']({ runId: manual.id }).events.post({
      attempt: 1,
      offset: 0,
      events,
      sessionId,
    });
    await runner['agent-runs']({ runId: manual.id }).result.post({ status: 'success' });
    expect((await api['agent-runs']({ runId: manual.id }).trace.get()).data!.sessionId).toBe(
      sessionId,
    );
    const history = (
      await api
        .projects({ projectKey: 'RUN' })
        ['agent-schedules']({ scheduleId: schedule.id })
        .runs.get()
    ).data!;
    expect(history[0].kind).toBe('external');
  }, 20_000);
});
