import { describe, it, expect, beforeEach } from 'bun:test';
import { db, agentRun, issue as issueTable } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { claimDueRuns, deferRun } from '#modules/agents/core/run-queue';

// A status schedule queues a run on an issue each time one enters its column, held back
// by the schedule's delay. The poller is not exercised, so the runs stay pending.

const schedules = (api: Api) => api.projects({ projectKey: 'MKT' })['agent-schedules'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const columns = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns;
  const backlog = columns.find((c) => c.stateType === 'backlog')!;
  const started = columns.find((c) => c.stateType === 'started')!;
  const agent = (
    await createAgent(asOwner, 'MKT', {
      name: 'Product Bot',
      username: 'product',
      kind: 'internal',
    })
  ).data!.agent;
  return { asOwner, backlog, started, agent };
}

function statusSchedule(
  api: Api,
  agentId: number,
  columnId: number,
  opts: { prompt?: string; delaySec?: number } = {},
) {
  return schedules(api).post({
    agentId,
    name: 'Analysis',
    type: 'status',
    columnId,
    ...opts,
  });
}

function createIssue(api: Api, columnId: number, title = 'Checkout flow') {
  return api.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

async function runsOf(api: Api, scheduleId: number) {
  return (await schedules(api)({ scheduleId }).runs.get()).data!;
}

describe('status agent schedules', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a status schedule with no cron and no task', async () => {
    const { asOwner, started, agent } = await setup();
    const created = await statusSchedule(asOwner, agent.id, started.id, { delaySec: 300 });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      type: 'status',
      prompt: '',
      cron: null,
      nextRunAt: null,
      columnId: started.id,
      delaySec: 300,
      status: 'active',
    });
  });

  it('refuses the fields of the other type and a missing required one', async () => {
    const { asOwner, started, agent } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Ops' });
    const opsColumn = (await asOwner.projects({ projectKey: 'OPS' }).get()).data!.columns[0];

    const withCron = await schedules(asOwner).post({
      agentId: agent.id,
      name: 'Analysis',
      type: 'status',
      columnId: started.id,
      cron: '0 9 * * *',
    });
    expect(withCron.status).toBe(400);
    const noColumn = await schedules(asOwner).post({
      agentId: agent.id,
      name: 'Analysis',
      type: 'status',
    });
    expect(noColumn.status).toBe(400);
    expect((await statusSchedule(asOwner, agent.id, opsColumn.id)).status).toBe(400);

    const cronWithColumn = await schedules(asOwner).post({
      agentId: agent.id,
      name: 'Daily',
      prompt: 'Triage.',
      cron: '0 9 * * *',
      columnId: started.id,
    });
    expect(cronWithColumn.status).toBe(400);
    const cronNoTask = await schedules(asOwner).post({
      agentId: agent.id,
      name: 'Daily',
      cron: '0 9 * * *',
    });
    expect(cronNoTask.status).toBe(400);

    const created = await statusSchedule(asOwner, agent.id, started.id);
    const patched = await schedules(asOwner)({ scheduleId: created.data!.id }).patch({
      cron: '0 9 * * *',
    });
    expect(patched.status).toBe(400);
  });

  it('queues a run on an issue moved into the column, held back by the delay', async () => {
    const { asOwner, backlog, started, agent } = await setup();
    const schedule = (
      await statusSchedule(asOwner, agent.id, started.id, {
        prompt: 'Write the acceptance criteria.',
        delaySec: 300,
      })
    ).data!;
    const issue = (await createIssue(asOwner, backlog.id)).data!;
    expect(await runsOf(asOwner, schedule.id)).toEqual([]);

    await asOwner.issues({ issueId: issue.id }).patch({ columnId: started.id });

    const runs = await runsOf(asOwner, schedule.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: 'pending', trigger: 'status' });
    expect(runs[0].prompt).toContain(`${issue.identifier}: "Checkout flow"`);
    expect(runs[0].prompt).toContain(`"${started.name}"`);
    expect(runs[0].prompt).toContain('Write the acceptance criteria.');

    const agentRuns = await asOwner
      .teams({ teamId: agent.teamId })
      ['ai-agents']({ agentId: agent.id })
      .runs.get();
    const run = agentRuns.data!.items[0];
    expect(run).toMatchObject({ trigger: 'status', issueId: issue.id });
    expect(new Date(run.nextAttemptAt).getTime() - Date.now()).toBeGreaterThan(290_000);

    const listed = (await schedules(asOwner).get()).data!.items[0];
    expect(listed.lastRunAt).not.toBeNull();
    expect(listed.pendingRuns).toBe(1);
  });

  it('queues a run on an issue created in the column', async () => {
    const { asOwner, started, agent } = await setup();
    const schedule = (await statusSchedule(asOwner, agent.id, started.id)).data!;

    await createIssue(asOwner, started.id);

    const runs = await runsOf(asOwner, schedule.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].prompt).toContain('Review it and take the appropriate next step.');
  });

  it('ends a waiting run when the issue leaves the column, and queues a new one on return', async () => {
    const { asOwner, backlog, started, agent } = await setup();
    const schedule = (await statusSchedule(asOwner, agent.id, started.id, { delaySec: 300 })).data!;
    const issue = (await createIssue(asOwner, backlog.id)).data!;

    await asOwner.issues({ issueId: issue.id }).patch({ columnId: started.id });
    await asOwner.issues({ issueId: issue.id }).patch({ columnId: backlog.id });
    expect((await runsOf(asOwner, schedule.id)).map((r) => r.status)).toEqual(['canceled']);

    await asOwner.issues({ issueId: issue.id }).patch({ columnId: started.id });
    expect((await runsOf(asOwner, schedule.id)).map((r) => r.status)).toEqual([
      'pending',
      'canceled',
    ]);
  });

  it('ends a run deferred for want of a slot when the issue leaves the column', async () => {
    const { asOwner, backlog, started, agent } = await setup();
    const schedule = (await statusSchedule(asOwner, agent.id, started.id)).data!;
    const issue = (await createIssue(asOwner, started.id)).data!;
    const [claimed] = await claimDueRuns();
    await deferRun(claimed.id, 30);

    await asOwner.issues({ issueId: issue.id }).patch({ columnId: backlog.id });

    expect((await runsOf(asOwner, schedule.id)).map((r) => r.status)).toEqual(['canceled']);
  });

  it('does not run while paused', async () => {
    const { asOwner, started, agent } = await setup();
    const schedule = (await statusSchedule(asOwner, agent.id, started.id)).data!;
    await schedules(asOwner)({ scheduleId: schedule.id }).patch({ status: 'paused' });

    await createIssue(asOwner, started.id);

    expect(await runsOf(asOwner, schedule.id)).toEqual([]);
  });

  it('does not start on a move the agent made itself', async () => {
    const { asOwner, backlog, started } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Runner Bot',
      username: 'runner',
      kind: 'external',
    });
    const asAgent = apiKeyApi(created.data!.apiKey!);
    const schedule = (await statusSchedule(asOwner, created.data!.agent.id, started.id)).data!;
    const issue = (await createIssue(asOwner, backlog.id)).data!;

    const moved = await asAgent.issues({ issueId: issue.id }).patch({ columnId: started.id });
    expect(moved.status).toBe(200);

    expect(await runsOf(asOwner, schedule.id)).toEqual([]);
  });

  it('makes the agent the delegate of the issue when it takes the run', async () => {
    const { asOwner, started } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Runner Bot',
      username: 'runner',
      kind: 'external',
      triggerOnAssign: true,
    });
    const agent = created.data!.agent;
    const asRunner = apiKeyApi(created.data!.apiKey!);
    await statusSchedule(asOwner, agent.id, started.id);
    const issue = (await createIssue(asOwner, started.id)).data!;
    expect(issue.delegateUserId).toBeNull();

    const claimed = await asRunner['agent-runs'].claim.post();
    expect(claimed.data!.run).toMatchObject({ trigger: 'status', issueId: issue.id });

    const after = (await asOwner.issues({ issueId: issue.id }).get()).data!;
    expect(after.delegateUserId).toBe(agent.userId);
    // The agent delegated to itself, which queues no delegation run.
    expect((await asRunner['agent-runs'].claim.post()).data!.run).toBeNull();
  });

  it('retries a run whose start failed, and hands it out without the delegation', async () => {
    const { asOwner, started } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Runner Bot',
      username: 'runner',
      kind: 'external',
    });
    const asRunner = apiKeyApi(created.data!.apiKey!);
    await statusSchedule(asOwner, created.data!.agent.id, started.id);
    const issue = (await createIssue(asOwner, started.id)).data!;
    // Dates no update of the issue accepts, as an import can leave them.
    await db
      .update(issueTable)
      .set({ startDate: '2026-05-10', dueDate: '2026-05-01' })
      .where(eq(issueTable.id, issue.id));

    expect((await asRunner['agent-runs'].claim.post()).data!.run).toBeNull();
    const [failed] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));
    expect(failed.lastError).toContain('Due date');
    expect(failed.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    await db.update(agentRun).set({ nextAttemptAt: new Date() }).where(eq(agentRun.id, failed.id));
    const retried = (await asRunner['agent-runs'].claim.post()).data!.run;
    expect(retried).toMatchObject({ id: failed.id, attempts: 2 });
    const after = (await asOwner.issues({ issueId: issue.id }).get()).data!;
    expect(after.delegateUserId).toBeNull();
  });

  it('refuses to run a status schedule now', async () => {
    const { asOwner, started, agent } = await setup();
    const schedule = (await statusSchedule(asOwner, agent.id, started.id)).data!;
    const res = await schedules(asOwner)({ scheduleId: schedule.id }).run.post();
    expect(res.status).toBe(400);
  });

  it('keeps the column while a run is unfinished, and deletes the schedule with it after', async () => {
    const { asOwner, backlog, started, agent } = await setup();
    const schedule = (await statusSchedule(asOwner, agent.id, started.id)).data!;
    await createIssue(asOwner, started.id);
    const column = asOwner.projects({ projectKey: 'MKT' }).columns({ columnId: started.id });

    const refused = await column.delete({ mode: 'move', targetColumnId: backlog.id });
    expect(refused.status).toBe(409);

    await schedules(asOwner)({ scheduleId: schedule.id }).runs.cancel.post();
    const deleted = await column.delete({ mode: 'move', targetColumnId: backlog.id });
    expect(deleted.status).toBe(204);
    expect((await schedules(asOwner).get()).data!.items).toEqual([]);
  });
});
