import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { setRunAdmission } from '../../../core/run-admission';
import { scheduleRunRetry } from '../../../core/run-queue';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { apiKeyApi, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, teamOf } from '#tests/helpers/agents';

// The runner queue: a process on the operator's machine authenticates with the
// external agent's API key, claims one run at a time, and reports the result. Runs
// are queued the normal way — a mention on an issue — since the runner routes only
// drain the queue, they never fill it.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  const created = await createAgent(asOwner, 'MKT', {
    name: 'Ext Bot',
    username: 'ext',
    kind: 'external',
    triggerOnMention: true,
  });
  return {
    asOwner,
    columnId,
    agent: created.data!.agent,
    asRunner: apiKeyApi(created.data!.apiKey!),
    runnerKey: created.data!.apiKey!,
  };
}

// Queues one run for the agent by mentioning it on a new issue.
async function queueRun(asOwner: Api, columnId: number, username: string) {
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Landing page' })
  ).data!;
  await asOwner.issues({ issueId: issue.id }).comments.post({ body: `please review @${username}` });
  return issue;
}

describe('agent runner queue', () => {
  afterEach(() => setRunAdmission());
  beforeEach(async () => {
    await resetDb();
  });

  it('claims a queued run with its issue and prompt', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    const issue = await queueRun(asOwner, columnId, agent.username);

    const res = await asRunner['agent-runs'].claim.post();
    expect(res.status).toBe(200);
    expect(res.data!.run).toMatchObject({
      trigger: 'mention',
      issueId: issue.id,
      attempts: 1,
    });
    expect(res.data!.run!.issueIdentifier).toBe(`MKT-${issue.sequenceNumber}`);
    // The prompt is framed the way an internal agent's is: what happened, what to do
    // about it, and the trigger text itself.
    expect(res.data!.run!.prompt).toContain('You were mentioned');
    expect(res.data!.run!.prompt).toContain('please review');
    expect(res.data!.run!.systemPrompt).toContain('Run mode');
  });

  it('logs on the issue that the agent picked the run up and how it ended', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    const issue = await queueRun(asOwner, columnId, agent.username);
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;

    await asRunner['agent-runs']({ runId: run.id }).result.post({
      status: 'failed',
      error: 'claude exited with 1',
    });

    const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
    expect(feed.data!.items).toContainEqual(
      expect.objectContaining({ action: 'agent_started', actorUserId: agent.userId }),
    );
    expect(feed.data!.items).toContainEqual(
      expect.objectContaining({
        action: 'agent_finished',
        payload: { subject: { value: 'failed' } },
        actorUserId: agent.userId,
      }),
    );
  });

  it("mixes the agent's own instructions into the system prompt", async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await asOwner
      .teams({ teamId: await teamOf(asOwner, 'MKT') })
      ['ai-agents']({ agentId: agent.id })
      .patch({ instructions: 'Always answer in German.' });
    await queueRun(asOwner, columnId, agent.username);

    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;
    expect(run.systemPrompt).toContain('Always answer in German.');
    expect(run.systemPrompt).toContain('Marketing');
  });

  it('returns null when the queue is empty', async () => {
    const { asRunner } = await setup();
    const res = await asRunner['agent-runs'].claim.post();
    expect(res.status).toBe(200);
    expect(res.data!.run).toBeNull();
  });

  it('hands a claimed run to no one else until its lease expires', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await queueRun(asOwner, columnId, agent.username);

    expect((await asRunner['agent-runs'].claim.post()).data!.run).not.toBeNull();
    expect((await asRunner['agent-runs'].claim.post()).data!.run).toBeNull();
  });

  it('records a success and shows it in the run history', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await queueRun(asOwner, columnId, agent.username);
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;

    const res = await asRunner['agent-runs']({ runId: run.id }).result.post({
      status: 'success',
      output: 'Opened PR #12',
    });
    expect(res.status).toBe(204);

    const history = await asOwner
      .teams({ teamId: await teamOf(asOwner, 'MKT') })
      ['ai-agents']({ agentId: agent.id })
      .runs.get({ query: {} });
    expect(history.data!.items[0]).toMatchObject({
      id: run.id,
      status: 'success',
      output: 'Opened PR #12',
    });
  });

  it('records a failure with its error', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await queueRun(asOwner, columnId, agent.username);
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;

    await asRunner['agent-runs']({ runId: run.id }).result.post({
      status: 'failed',
      error: 'claude exited with 1',
    });

    const history = await asOwner
      .teams({ teamId: await teamOf(asOwner, 'MKT') })
      ['ai-agents']({ agentId: agent.id })
      .runs.get({ query: {} });
    expect(history.data!.items[0]).toMatchObject({
      status: 'failed',
      lastError: 'claude exited with 1',
    });
  });

  it('rejects a result for a run that is already finished', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await queueRun(asOwner, columnId, agent.username);
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;
    await asRunner['agent-runs']({ runId: run.id }).result.post({ status: 'success' });

    const res = await asRunner['agent-runs']({ runId: run.id }).result.post({ status: 'success' });
    expect(res.status).toBe(404);
  });

  it("rejects another agent's run", async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await queueRun(asOwner, columnId, agent.username);
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;
    const other = await createAgent(asOwner, 'MKT', {
      name: 'Other Bot',
      username: 'other',
      kind: 'external',
    });
    const asOtherRunner = apiKeyApi(other.data!.apiKey!);

    expect(
      (await asOtherRunner['agent-runs']({ runId: run.id }).result.post({ status: 'success' }))
        .status,
    ).toBe(404);
    expect((await asOtherRunner['agent-runs']({ runId: run.id }).heartbeat.post()).status).toBe(
      404,
    );
  });

  it('keeps a claimed run leased through a heartbeat', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await queueRun(asOwner, columnId, agent.username);
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;

    expect((await asRunner['agent-runs']({ runId: run.id }).heartbeat.post()).status).toBe(204);
    expect((await asRunner['agent-runs']({ runId: run.id }).heartbeat.post()).status).toBe(204);
  });

  it('claims once across concurrent clients and only a successful heartbeat extends the lease', async () => {
    const { asOwner, asRunner, agent, columnId, runnerKey } = await setup();
    await queueRun(asOwner, columnId, agent.username);
    const clients = [asRunner, apiKeyApi(runnerKey)];
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => clients[i % 2]['agent-runs'].claim.post()),
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    const runs = results.flatMap((result) => (result.data?.run ? [result.data.run] : []));
    expect(runs).toHaveLength(1);
    const run = runs[0];
    const read = async () => (await db.select().from(agentRun).where(eq(agentRun.id, run.id)))[0];
    expect((await read()).attempts).toBe(1);
    const lease = new Date(Date.now() + 30_000);
    await db.update(agentRun).set({ nextAttemptAt: lease }).where(eq(agentRun.id, run.id));
    for (const client of clients)
      expect((await client['agent-runs'].claim.post()).data!.run).toBeNull();
    expect((await read()).nextAttemptAt.getTime()).toBe(lease.getTime());
    const route = asRunner['agent-runs']({ runId: run.id });
    expect((await route.heartbeat.post({ attempt: run.attempts })).status).toBe(204);
    expect((await read()).nextAttemptAt.getTime()).toBeGreaterThan(lease.getTime());
    await db
      .update(agentRun)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(agentRun.id, run.id));
    expect((await route.heartbeat.post({ attempt: run.attempts })).status).toBe(409);
    expect((await read()).nextAttemptAt.getTime()).toBe(0);
    const next = (await clients[1]['agent-runs'].claim.post()).data!.run!;
    expect(next).toMatchObject({ id: run.id, attempts: 2 });
    const current = await read();
    expect((await route.heartbeat.post()).status).toBe(409);
    expect(
      (
        await route.events.post({
          attempt: 2,
          offset: 0,
          events: [{ type: 'TOOL_CALL_START', toolCallId: 'tool-1', toolCallName: 'shell' }],
        })
      ).status,
    ).toBe(200);
    expect((await read()).nextAttemptAt).toEqual(current.nextAttemptAt);
    expect((await route.heartbeat.post({ attempt: 1 })).status).toBe(409);
    await scheduleRunRetry(run.id, 1000, 'old start failed', 1);
    expect(await read()).toEqual(current);
    expect((await route.heartbeat.post({ attempt: 2 })).status).toBe(204);
  });

  it('does not let an expired admission defer a newer executing attempt', async () => {
    const { asOwner, asRunner, agent, columnId } = await setup();
    await queueRun(asOwner, columnId, agent.username);
    let release!: () => void;
    let admitted!: (id: number) => void;
    const entered = new Promise<number>((resolve) => {
      admitted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setRunAdmission(async ({ id }) => {
      admitted(id);
      await gate;
      return 60;
    });
    const oldClaim = asRunner['agent-runs'].claim.post();
    const id = await entered;
    try {
      await db
        .update(agentRun)
        .set({ nextAttemptAt: new Date(0) })
        .where(eq(agentRun.id, id));
      setRunAdmission();
      const next = (await asRunner['agent-runs'].claim.post()).data!.run!;
      expect(next).toMatchObject({ id, attempts: 2 });
      release();
      expect((await oldClaim).data!.run).toBeNull();
      const [row] = await db.select().from(agentRun).where(eq(agentRun.id, id));
      expect(row.attempts).toBe(2);
      expect(row.executionStartedAt).not.toBeNull();
      expect(
        (await asRunner['agent-runs']({ runId: id }).heartbeat.post({ attempt: 2 })).status,
      ).toBe(204);
    } finally {
      release();
      await oldClaim;
    }
  });

  it('records presence on the agent when its runner polls', async () => {
    const { asOwner, asRunner, agent } = await setup();
    expect(
      (
        await asOwner
          .teams({ teamId: await teamOf(asOwner, 'MKT') })
          ['ai-agents']({ agentId: agent.id })
          .get()
      ).data!.lastSeenAt,
    ).toBeNull();

    await asRunner['agent-runs'].claim.post();

    const after = await asOwner
      .teams({ teamId: await teamOf(asOwner, 'MKT') })
      ['ai-agents']({ agentId: agent.id })
      .get();
    expect(after.data!.lastSeenAt).not.toBeNull();
  });

  it('refuses a caller that is not an agent', async () => {
    const { asOwner } = await setup();
    expect((await asOwner['agent-runs'].claim.post()).status).toBe(403);
  });

  it('hands a scheduled run to the runner with the task as its prompt', async () => {
    const { asOwner, asRunner, agent } = await setup();
    const schedule = await asOwner.projects({ projectKey: 'MKT' })['agent-schedules'].post({
      agentId: agent.id,
      name: 'Nightly triage',
      prompt: 'Triage the new issues.',
      cron: '0 9 * * *',
    });
    expect(schedule.status).toBe(201);
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['agent-schedules']({ scheduleId: schedule.data!.id })
      .run.post();

    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;
    expect(run).toMatchObject({ trigger: 'manual', issueId: null, issueIdentifier: null });
    expect(run.prompt).toContain('Triage the new issues.');
  });
});
