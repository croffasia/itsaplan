import { describe, it, expect, beforeEach } from 'bun:test';
import { apiKeyApi, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { untaggedRoutes } from '#tests/helpers/mcp';

// A schedule sends a fixed task to an internal agent on a cron, in UTC. The worker
// picks up the queued runs, so a run created here stays pending. Access is the
// ai_agents permission resource.

const schedules = (api: Api) => api.projects({ projectKey: 'MKT' })['agent-schedules'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

async function createAgent(
  api: Api,
  opts: { username?: string; kind?: 'internal' | 'external'; projectKey?: string } = {},
): Promise<number> {
  const res = await api.projects({ projectKey: opts.projectKey ?? 'MKT' })['ai-agents'].post({
    name: 'Triage Bot',
    username: opts.username ?? 'triage',
    kind: opts.kind ?? 'internal',
  });
  return res.data!.agent.id;
}

// A second project owner, so the permission matrix is out of the way and only the
// agent's runner scope decides what they may do.
async function addSecondOwner(asOwner: Api): Promise<Api> {
  const user = await signUpTestUser({ name: 'Second' });
  const invite = await asOwner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'owner' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return api;
}

// An external agent plus a client authenticated as its runner, which is how a run gets
// claimed (and stamped as started) without a worker.
async function createRunnerAgent(api: Api): Promise<{ agentId: number; asRunner: Api }> {
  const res = await api.projects({ projectKey: 'MKT' })['ai-agents'].post({
    name: 'Runner Bot',
    username: 'runner',
    kind: 'external',
  });
  return { agentId: res.data!.agent.id, asRunner: apiKeyApi(res.data!.apiKey!) };
}

async function createSchedule(api: Api, agentId: number, cron = '0 9 * * *') {
  return schedules(api).post({
    agentId,
    name: 'Daily triage',
    prompt: 'Triage the new issues.',
    cron,
  });
}

describe('agent schedules', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a schedule and lists it with its next run', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const created = await createSchedule(asOwner, agentId);
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      agentId,
      agentName: 'Triage Bot',
      name: 'Daily triage',
      cron: '0 9 * * *',
      timezone: 'UTC',
      status: 'active',
      lastRunAt: null,
      lastRunStatus: null,
    });
    expect(new Date(created.data!.nextRunAt).getTime()).toBeGreaterThan(Date.now());

    const list = await schedules(asOwner).get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);
    expect(list.data?.[0].id).toBe(created.data!.id);
  });

  it('rejects an invalid cron expression', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const res = await createSchedule(asOwner, agentId, 'not a cron');
    expect(res.status).toBe(400);
  });

  it('rejects a blank name', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const res = await schedules(asOwner).post({
      agentId,
      name: ' ',
      prompt: 'Triage the new issues.',
      cron: '0 9 * * *',
    });
    expect(res.status).toBe(400);
  });

  it('schedules an external agent, whose runner claims the run', async () => {
    const { asOwner } = await setup();
    const externalId = await createAgent(asOwner, { username: 'hook', kind: 'external' });
    expect((await createSchedule(asOwner, externalId)).status).toBe(201);
  });

  it("keeps an 'owner'-scoped agent's tasks to its owner", async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner, { username: 'hook', kind: 'external' });
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId })
      .patch({ runnerScope: 'owner' });
    const asSecond = await addSecondOwner(asOwner);

    expect((await createSchedule(asSecond, agentId)).status).toBe(403);

    const own = await createSchedule(asOwner, agentId);
    expect(own.status).toBe(201);
    expect((await schedules(asSecond)({ scheduleId: own.data!.id }).run.post()).status).toBe(403);
    expect((await schedules(asOwner)({ scheduleId: own.data!.id }).run.post()).status).toBe(202);
    expect(
      (await schedules(asSecond)({ scheduleId: own.data!.id }).runs.cancel.post()).status,
    ).toBe(403);
    expect((await schedules(asSecond).get()).data?.[0]).toMatchObject({ canTrigger: false });
    expect((await schedules(asOwner).get()).data?.[0]).toMatchObject({ canTrigger: true });
  });

  it('rejects an agent of another project', async () => {
    const { asOwner } = await setup();

    await asOwner.projects.post({ key: 'ENG', name: 'Engineering' });
    const foreignId = await createAgent(asOwner, { username: 'eng', projectKey: 'ENG' });
    expect((await createSchedule(asOwner, foreignId)).status).toBe(400);
  });

  it('pauses a schedule and moves the next run when it is resumed', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const created = await createSchedule(asOwner, agentId);
    const scheduleId = created.data!.id;

    const paused = await schedules(asOwner)({ scheduleId }).patch({ status: 'paused' });
    expect(paused.status).toBe(200);
    expect(paused.data).toMatchObject({ status: 'paused' });
    expect(new Date(paused.data!.nextRunAt).getTime()).toBe(
      new Date(created.data!.nextRunAt).getTime(),
    );

    const resumed = await schedules(asOwner)({ scheduleId }).patch({ status: 'active' });
    expect(resumed.data).toMatchObject({ status: 'active' });
    expect(new Date(resumed.data!.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('recomputes the next run when the cron changes', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const created = await createSchedule(asOwner, agentId, '0 9 * * *');
    const updated = await schedules(asOwner)({ scheduleId: created.data!.id }).patch({
      cron: '30 9 * * *',
      prompt: 'Triage and label the new issues.',
    });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({
      cron: '30 9 * * *',
      prompt: 'Triage and label the new issues.',
    });
    expect(new Date(updated.data!.nextRunAt).getUTCMinutes()).toBe(30);
  });

  it('queues a manual run and reports it in the run history', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const created = await createSchedule(asOwner, agentId);
    const scheduleId = created.data!.id;

    const run = await schedules(asOwner)({ scheduleId }).run.post();
    expect(run.status).toBe(202);
    expect(typeof run.data?.runId).toBe('number');

    const runs = await schedules(asOwner)({ scheduleId }).runs.get();
    expect(runs.status).toBe(200);
    expect(runs.data).toHaveLength(1);
    expect(runs.data?.[0]).toMatchObject({
      id: run.data!.runId,
      trigger: 'manual',
      status: 'pending',
      prompt: 'Triage the new issues.',
      output: null,
      finishedAt: null,
    });
  });

  it('shows the token counts of each run of a schedule', async () => {
    const { asOwner } = await setup();
    const { agentId, asRunner } = await createRunnerAgent(asOwner);
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;
    const runs = () => schedules(asOwner)({ scheduleId }).runs.get();

    await schedules(asOwner)({ scheduleId }).run.post();
    const first = (await asRunner['agent-runs'].claim.post()).data!.run!;
    await asRunner['agent-runs']({ runId: first.id }).result.post({
      status: 'success',
      output: 'Triaged.',
      usage: { inputTokens: 30_000, outputTokens: 400 },
    });
    expect((await runs()).data![0].contextTokens).toBe(30_400);

    // Each run carries its own counts, so a later one does not restate the one before.
    await schedules(asOwner)({ scheduleId }).run.post();
    const second = (await asRunner['agent-runs'].claim.post()).data!.run!;
    await asRunner['agent-runs']({ runId: second.id }).result.post({
      status: 'success',
      output: 'Triaged again.',
      usage: { inputTokens: 12_000, outputTokens: 100 },
    });
    const both = (await runs()).data!;
    expect(both.map((r) => r.contextTokens)).toEqual([12_100, 30_400]);
  });

  it('leaves a run without counts where its runner reports none', async () => {
    const { asOwner } = await setup();
    const { agentId, asRunner } = await createRunnerAgent(asOwner);
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;

    await schedules(asOwner)({ scheduleId }).run.post();
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;
    await asRunner['agent-runs']({ runId: run.id }).result.post({
      status: 'success',
      output: 'Done.',
    });

    expect(
      (await schedules(asOwner)({ scheduleId }).runs.get()).data![0].contextTokens,
    ).toBeUndefined();
  });

  it('ends every pending run of a schedule', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner, { username: 'hook', kind: 'external' });
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;
    await schedules(asOwner)({ scheduleId }).run.post();
    await schedules(asOwner)({ scheduleId }).run.post();
    expect((await schedules(asOwner).get()).data?.[0]).toMatchObject({ pendingRuns: 2 });

    const canceled = await schedules(asOwner)({ scheduleId }).runs.cancel.post();
    expect(canceled.status).toBe(200);
    expect(canceled.data).toMatchObject({ canceled: 2 });

    const runs = await schedules(asOwner)({ scheduleId }).runs.get();
    expect(runs.data?.map((run) => run.status)).toEqual(['canceled', 'canceled']);
    expect(runs.data?.[0].finishedAt).not.toBeNull();
    expect((await schedules(asOwner).get()).data?.[0]).toMatchObject({
      pendingRuns: 0,
      lastRunStatus: 'canceled',
    });

    // Nothing is left to end, and a finished run is not touched again.
    expect((await schedules(asOwner)({ scheduleId }).runs.cancel.post()).data).toMatchObject({
      canceled: 0,
    });
  });

  it('ends one pending run and 404s on it afterwards', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner, { username: 'hook', kind: 'external' });
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;
    const kept = (await schedules(asOwner)({ scheduleId }).run.post()).data!.runId;
    const runId = (await schedules(asOwner)({ scheduleId }).run.post()).data!.runId;

    const canceled = await schedules(asOwner)({ scheduleId }).runs({ runId }).cancel.post();
    expect(canceled.status).toBe(200);
    expect(canceled.data).toMatchObject({ canceled: 1 });
    expect((await schedules(asOwner)({ scheduleId }).runs({ runId }).cancel.post()).status).toBe(
      404,
    );

    const runs = await schedules(asOwner)({ scheduleId }).runs.get();
    expect(runs.data?.find((run) => run.id === runId)).toMatchObject({ status: 'canceled' });
    expect(runs.data?.find((run) => run.id === kept)).toMatchObject({ status: 'pending' });
  });

  it('leaves a run its runner already claimed', async () => {
    const { asOwner } = await setup();
    const { agentId, asRunner } = await createRunnerAgent(asOwner);
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;
    await schedules(asOwner)({ scheduleId }).run.post();
    const runId = (await asRunner['agent-runs'].claim.post()).data!.run!.id;

    expect((await schedules(asOwner).get()).data?.[0]).toMatchObject({ pendingRuns: 0 });
    expect((await schedules(asOwner)({ scheduleId }).runs.cancel.post()).data).toMatchObject({
      canceled: 0,
    });
    expect((await schedules(asOwner)({ scheduleId }).runs({ runId }).cancel.post()).status).toBe(
      404,
    );
    expect((await schedules(asOwner)({ scheduleId }).runs.get()).data?.[0]).toMatchObject({
      status: 'pending',
    });
  });

  it('deletes a schedule with its runs and 404s on it afterwards', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;
    await schedules(asOwner)({ scheduleId }).run.post();
    const agentRuns = () =>
      asOwner.projects({ projectKey: 'MKT' })['ai-agents']({ agentId }).runs.get({ query: {} });
    expect((await agentRuns()).data?.items).toHaveLength(1);

    expect((await schedules(asOwner)({ scheduleId }).delete()).status).toBe(204);
    expect((await schedules(asOwner).get()).data).toEqual([]);
    expect((await schedules(asOwner)({ scheduleId }).delete()).status).toBe(404);
    expect((await agentRuns()).data?.items).toEqual([]);
  });

  it('404s on an unknown schedule', async () => {
    const { asOwner } = await setup();
    const patched = await schedules(asOwner)({ scheduleId: 999999 }).patch({ status: 'paused' });
    expect(patched.status).toBe(404);
    expect((await schedules(asOwner)({ scheduleId: 999999 }).run.post()).status).toBe(404);
    expect((await schedules(asOwner)({ scheduleId: 999999 }).runs.get()).status).toBe(404);
    expect((await schedules(asOwner)({ scheduleId: 999999 }).runs.cancel.post()).status).toBe(404);
    expect(
      (await schedules(asOwner)({ scheduleId: 999999 }).runs({ runId: 1 }).cancel.post()).status,
    ).toBe(404);
  });

  it('denies a non-member', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const asOutsider = authedApi(outsider.cookie);

    expect((await schedules(asOutsider).get()).status).toBe(403);
    expect((await schedules(asOutsider)({ scheduleId }).run.post()).status).toBe(403);
    expect((await schedules(asOutsider)({ scheduleId }).runs.cancel.post()).status).toBe(403);
    expect((await schedules(asOutsider)({ scheduleId }).delete()).status).toBe(403);
  });

  // Schedules are managed entirely over MCP: every route is a tool.
  it('exposes every schedule route to MCP', () => {
    expect(untaggedRoutes((route) => route.includes('/agent-schedules'))).toEqual([]);
  });
});
