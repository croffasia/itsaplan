import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { HttpError } from '#shared/lib';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { setScheduleIssueFilter, setScheduleOptionsCheck, setScheduleTypes } from '../../extension';
import { queueScheduleRuns } from '../../issue-runs';

// What an extension installs into agent schedules: a type of its own, the options it
// keeps on a schedule, and the issues that start a run. Each test installs what it
// needs and the afterEach puts the defaults back, since the hooks are process-wide.

const schedules = (api: Api, projectKey = 'MKT') => api.projects({ projectKey })['agent-schedules'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const columns = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns;
  const backlog = columns.find((c) => c.stateType === 'backlog')!;
  const started = columns.find((c) => c.stateType === 'started')!;
  const created = await createAgent(asOwner, 'MKT', {
    name: 'Product Bot',
    username: 'product',
    kind: 'external',
  });
  return { owner, asOwner, backlog, started, agent: created.data!.agent };
}

function createIssue(api: Api, columnId: number, title = 'Checkout flow', projectKey = 'MKT') {
  return api.projects({ projectKey }).issues.post({ columnId, title });
}

async function runsOf(api: Api, scheduleId: number) {
  return (await schedules(api)({ scheduleId }).runs.get()).data!;
}

const keepOptions = async ({ options }: { options: Record<string, unknown> }) => options;

const lead = (issue: { identifier: string; title: string }) =>
  `A label was added to ${issue.identifier}: "${issue.title}".`;

describe('agent schedule extension', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    setScheduleTypes();
    setScheduleOptionsCheck();
    setScheduleIssueFilter();
  });

  it('refuses options and an unknown type while nothing is installed', async () => {
    const { asOwner, agent } = await setup();
    const cron = { agentId: agent.id, prompt: 'Triage.', cron: '0 9 * * *' };

    const withOptions = await schedules(asOwner).post({ ...cron, name: 'A', options: { a: 1 } });
    expect(withOptions.status).toBe(400);
    const event = await schedules(asOwner).post({ agentId: agent.id, name: 'B', type: 'event' });
    expect(event.status).toBe(400);

    const plain = await schedules(asOwner).post({ ...cron, name: 'C', options: {} });
    expect(plain.status).toBe(201);
    expect(plain.data!.options).toEqual({});
    const patched = await schedules(asOwner)({ scheduleId: plain.data!.id }).patch({
      options: { a: 1 },
    });
    expect(patched.status).toBe(400);
  });

  it('creates a schedule of an added type with the options as the check returns them', async () => {
    const { asOwner, agent } = await setup();
    setScheduleTypes(['event']);
    setScheduleOptionsCheck(async ({ type, options }) => {
      if (typeof options.event !== 'string') throw new HttpError(400, 'Event is required');
      return { type, event: options.event };
    });

    const missing = await schedules(asOwner).post({ agentId: agent.id, name: 'A', type: 'event' });
    expect(missing.status).toBe(400);

    const created = await schedules(asOwner).post({
      agentId: agent.id,
      name: 'Labels',
      type: 'event',
      delaySec: 60,
      options: { event: 'issue.label_changed', dropped: true },
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      type: 'event',
      prompt: '',
      cron: null,
      nextRunAt: null,
      columnId: null,
      delaySec: 60,
      options: { type: 'event', event: 'issue.label_changed' },
    });

    const patched = await schedules(asOwner)({ scheduleId: created.data!.id }).patch({
      options: { event: 'comment.created' },
    });
    expect(patched.data!.options).toEqual({ type: 'event', event: 'comment.created' });
  });

  it('refuses a cron, a column and a run on demand for an added type', async () => {
    const { asOwner, agent, started } = await setup();
    setScheduleTypes(['event']);
    const base = { agentId: agent.id, type: 'event' };

    const withCron = await schedules(asOwner).post({ ...base, name: 'A', cron: '0 9 * * *' });
    expect(withCron.status).toBe(400);
    const withColumn = await schedules(asOwner).post({ ...base, name: 'B', columnId: started.id });
    expect(withColumn.status).toBe(400);

    const created = (await schedules(asOwner).post({ ...base, name: 'C' })).data!;
    expect((await schedules(asOwner)({ scheduleId: created.id }).run.post()).status).toBe(400);
  });

  it('queues runs of an added type on the issues of its project', async () => {
    const { owner, asOwner, agent, backlog } = await setup();
    setScheduleTypes(['event']);
    const event = (
      await schedules(asOwner).post({
        agentId: agent.id,
        name: 'Labels',
        type: 'event',
        prompt: 'Sort it into a cycle.',
      })
    ).data!;
    const cron = (
      await schedules(asOwner).post({
        agentId: agent.id,
        name: 'Daily',
        prompt: 'Triage.',
        cron: '0 9 * * *',
      })
    ).data!;
    const issue = (await createIssue(asOwner, backlog.id)).data!;
    await asOwner.projects.post({ key: 'OPS', name: 'Ops' });
    const opsColumn = (await asOwner.projects({ projectKey: 'OPS' }).get()).data!.columns[0];
    const other = (await createIssue(asOwner, opsColumn.id, 'Elsewhere', 'OPS')).data!;

    await queueScheduleRuns([event.id, cron.id], [issue.id, other.id], owner.userId, lead);

    const runs = await runsOf(asOwner, event.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: 'pending', trigger: 'event' });
    expect(runs[0].prompt).toBe(
      `A label was added to ${issue.identifier}: "Checkout flow".\n\nSort it into a cycle.`,
    );
    expect(await runsOf(asOwner, cron.id)).toEqual([]);
    expect(
      (await schedules(asOwner).get()).data!.items.find((s) => s.id === event.id),
    ).toMatchObject({ pendingRuns: 1 });
  });

  it("skips a paused schedule and the agent's own change", async () => {
    const { asOwner, agent, backlog } = await setup();
    setScheduleTypes(['event']);
    const event = (
      await schedules(asOwner).post({ agentId: agent.id, name: 'Labels', type: 'event' })
    ).data!;
    const issue = (await createIssue(asOwner, backlog.id)).data!;

    await queueScheduleRuns([event.id], [issue.id], agent.userId, lead);
    expect(await runsOf(asOwner, event.id)).toEqual([]);

    await schedules(asOwner)({ scheduleId: event.id }).patch({ status: 'paused' });
    await queueScheduleRuns([event.id], [issue.id], null, lead);
    expect(await runsOf(asOwner, event.id)).toEqual([]);
  });

  it('starts a status run only on the issues the filter lets through', async () => {
    const { asOwner, backlog, started, agent } = await setup();
    setScheduleOptionsCheck(keepOptions);
    const seen: unknown[] = [];
    setScheduleIssueFilter(async (schedule, issueIds) => {
      seen.push(schedule.options);
      return issueIds.slice(1);
    });
    const schedule = (
      await schedules(asOwner).post({
        agentId: agent.id,
        name: 'Analysis',
        type: 'status',
        columnId: started.id,
        options: { labels: ['bug'] },
      })
    ).data!;
    const issue = (await createIssue(asOwner, backlog.id)).data!;

    await asOwner.issues({ issueId: issue.id }).patch({ columnId: started.id });

    expect(seen).toEqual([{ labels: ['bug'] }]);
    expect(await runsOf(asOwner, schedule.id)).toEqual([]);
    const listed = (await schedules(asOwner).get()).data!.items[0];
    expect(listed.lastRunAt).toBeNull();
  });

  it("hands a copied schedule's options to the check with the copy's ids", async () => {
    const { asOwner, agent } = await setup();
    setScheduleTypes(['event']);
    setScheduleOptionsCheck(async ({ options, copy }) =>
      copy ? { labelIds: (options.labelIds as number[]).map((id) => copy.label.get(id)) } : options,
    );
    const label = (
      await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'bug', color: '#ff0000' })
    ).data!;
    await schedules(asOwner).post({
      agentId: agent.id,
      name: 'Bugs',
      type: 'event',
      options: { labelIds: [label.id] },
    });

    await asOwner.projects({ projectKey: 'MKT' }).copy.post({
      key: 'DST',
      name: 'Destination',
      include: { schedules: true, labels: true },
    });

    const copiedLabel = (await asOwner.projects({ projectKey: 'DST' }).get()).data!.labels.find(
      (l) => l.name === 'bug',
    )!;
    expect(copiedLabel.id).not.toBe(label.id);
    const copied = (await schedules(asOwner, 'DST').get()).data!.items;
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({ type: 'event', options: { labelIds: [copiedLabel.id] } });
  });

  it('copies the options of a schedule as they are while nothing is installed', async () => {
    const { asOwner, agent } = await setup();
    setScheduleTypes(['event']);
    setScheduleOptionsCheck(keepOptions);
    await schedules(asOwner).post({
      agentId: agent.id,
      name: 'Labels',
      type: 'event',
      options: { event: 'issue.label_changed' },
    });
    setScheduleTypes();
    setScheduleOptionsCheck();

    const res = await asOwner.projects({ projectKey: 'MKT' }).copy.post({
      key: 'DST',
      name: 'Destination',
      include: { schedules: true },
    });

    expect(res.status).toBe(201);
    const copied = (await schedules(asOwner, 'DST').get()).data!.items;
    expect(copied[0]).toMatchObject({ type: 'event', options: { event: 'issue.label_changed' } });
  });
});
