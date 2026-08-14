import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
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
  });

  it('denies a non-member', async () => {
    const { asOwner } = await setup();
    const agentId = await createAgent(asOwner);
    const scheduleId = (await createSchedule(asOwner, agentId)).data!.id;
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const asOutsider = authedApi(outsider.cookie);

    expect((await schedules(asOutsider).get()).status).toBe(403);
    expect((await schedules(asOutsider)({ scheduleId }).run.post()).status).toBe(403);
    expect((await schedules(asOutsider)({ scheduleId }).delete()).status).toBe(403);
  });

  // Schedules are managed entirely over MCP: every route is a tool.
  it('exposes every schedule route to MCP', () => {
    expect(untaggedRoutes((route) => route.includes('/agent-schedules'))).toEqual([]);
  });
});
