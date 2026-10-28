import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { setRunAdmission } from '../../../core/run-admission';
import { scheduleRunRetry } from '../../../core/run-queue';

async function setup() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  const project = (await createProject(api, { key: 'RUN', name: 'Runs' })).data!;
  const view = (await api.projects({ projectKey: 'RUN' }).get()).data!;
  const created = await createAgent(api, 'RUN', {
    name: 'Runner',
    username: 'runner',
    kind: 'external',
    triggerOnMention: true,
  });
  const issue = (
    await api.projects({ projectKey: 'RUN' }).issues.post({
      title: 'Run this',
      columnId: view.columns[0].id,
    })
  ).data!;
  await api.issues({ issueId: issue.id }).comments.post({ body: '@runner start' });
  return {
    api,
    project,
    issue,
    agent: created.data!.agent,
    runner: apiKeyApi(created.data!.apiKey!),
  };
}

const scopes = { query: { scopes: 'runnerQueue:1' } };

describe('runner queue', () => {
  beforeEach(resetDb);
  afterEach(() => setRunAdmission());

  it('separates waiting, executing and finished runs without changing pending status', async () => {
    const { api, runner, issue } = await setup();
    const queued = await api['agent-runs'].queue.get();
    expect(queued.status).toBe(200);
    expect(queued.data).toMatchObject({ total: 1, queued: 1, running: 0 });
    expect(queued.data!.items[0]).toMatchObject({
      status: 'pending',
      executionState: 'queued',
      runnerState: 'never',
    });
    const before = (await api.sync.rev.get(scopes)).data!.revs['runnerQueue:1'];
    const claimed = (await runner['agent-runs'].claim.post()).data!.run!;
    const running = await api['agent-runs'].queue.get();
    expect(running.data).toMatchObject({ total: 1, queued: 0, running: 1 });
    expect(running.data!.items[0]).toMatchObject({
      id: claimed.id,
      status: 'pending',
      executionState: 'running',
      runnerState: 'online',
    });
    expect((await api.sync.rev.get(scopes)).data!.revs['runnerQueue:1']).not.toBe(before);
    expect(
      (await api.issues({ issueId: issue.id })['agent-runs'].get()).data!.items[0].executionState,
    ).toBe('running');
    await runner['agent-runs']({ runId: claimed.id }).heartbeat.post();
    expect((await api['agent-runs'].queue.get()).data!.running).toBe(1);
    await runner['agent-runs']({ runId: claimed.id }).result.post({
      status: 'success',
      output: 'Done',
    });
    expect((await api['agent-runs'].queue.get()).data).toMatchObject({
      total: 1,
      running: 0,
      queued: 0,
    });
    expect(
      (await api['agent-runs'].queue.get({ query: { runId: claimed.id } })).data!.items[0],
    ).toMatchObject({
      id: claimed.id,
      executionState: 'success',
      output: 'Done',
    });
    expect(
      (await api.issues({ issueId: issue.id })['agent-runs'].get()).data!.items[0].executionState,
    ).toBe('success');
  });

  it('keeps admission delays and retry backoff in the waiting state', async () => {
    const { api, runner } = await setup();
    setRunAdmission(async () => 60);
    expect((await runner['agent-runs'].claim.post()).data!.run).toBeNull();
    const queued = (await api['agent-runs'].queue.get()).data!.items[0];
    expect(queued).toMatchObject({ executionState: 'queued', attempts: 0 });
    expect((await runner['agent-runs']({ runId: queued.id }).heartbeat.post()).status).toBe(404);
    setRunAdmission();
    // Move the admission deadline forward without sleeping through a real minute.
    await db
      .update(agentRun)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(agentRun.id, queued.id));
    const claimed = (await runner['agent-runs'].claim.post()).data!.run!;
    await scheduleRunRetry(claimed.id, 60_000, 'Temporary failure');
    expect((await runner['agent-runs']({ runId: claimed.id }).heartbeat.post()).status).toBe(404);
    expect((await api['agent-runs'].queue.get()).data!.items[0]).toMatchObject({
      executionState: 'queued',
      lastError: 'Temporary failure',
    });
    setRunAdmission(async () => 60);
    await db
      .update(agentRun)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(agentRun.id, claimed.id));
    expect((await runner['agent-runs'].claim.post()).data!.run).toBeNull();
    expect((await api['agent-runs'].queue.get()).data!.items[0]).toMatchObject({
      executionState: 'queued',
      attempts: 1,
    });
  });

  it('shows an expired execution lease as waiting', async () => {
    const { api, runner } = await setup();
    const run = (await runner['agent-runs'].claim.post()).data!.run!;
    await db
      .update(agentRun)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(agentRun.id, run.id));
    expect((await api['agent-runs'].queue.get()).data).toMatchObject({ queued: 1, running: 0 });
    const reclaimed = (await runner['agent-runs'].claim.post()).data!.run!;
    expect(reclaimed).toMatchObject({ id: run.id, attempts: 2 });
    expect((await api['agent-runs'].queue.get()).data!.items[0].executionState).toBe('running');
  });

  it('filters projects, counts and markers by both read permissions', async () => {
    const { api, project, agent } = await setup();
    const other = (
      await api.teams({ teamId: project.teamId }).projects.post({ key: 'HID', name: 'Hidden' })
    ).data!;
    await api
      .teams({ teamId: project.teamId })
      ['ai-agents']({ agentId: agent.id })
      .projects.put({ projectIds: [project.id, other.id] });
    const columnId = (await api.projects({ projectKey: 'HID' }).get()).data!.columns[0].id;
    const issue = (
      await api.projects({ projectKey: 'HID' }).issues.post({ columnId, title: 'Secret' })
    ).data!;
    await api.issues({ issueId: issue.id }).comments.post({ body: '@runner hidden work' });
    const role = (
      await createRole(api, 'RUN', {
        name: 'Run reader',
        permissions: { work_items: { read: true }, ai_agents: { read: true } },
      })
    ).data!;
    const reader = await addProjectMember(api, 'RUN', role.id);
    expect((await api['agent-runs'].queue.get()).data!.total).toBe(2);
    const mine = (await reader['agent-runs'].queue.get()).data!;
    expect(mine.total).toBe(1);
    expect(mine.items[0].issueTitle).toBe('Run this');
    const marker = (await reader.sync.rev.get(scopes)).data!.revs['runnerQueue:1'];
    await api.issues({ issueId: issue.id }).comments.post({ body: '@runner more hidden work' });
    expect((await reader.sync.rev.get(scopes)).data!.revs['runnerQueue:1']).toBe(marker);
    for (const permissions of [{ work_items: { read: true } }, { ai_agents: { read: true } }]) {
      const restricted = (
        await createRole(api, 'RUN', {
          name: JSON.stringify(permissions),
          permissions,
        })
      ).data!;
      const denied = await addProjectMember(api, 'RUN', restricted.id);
      expect((await denied['agent-runs'].queue.get()).data).toMatchObject({ items: [], total: 0 });
      expect(
        (await denied['agent-runs'].queue.get({ query: { runId: mine.items[0].id } })).data,
      ).toMatchObject({ items: [], total: 0 });
      expect((await denied.sync.rev.get(scopes)).data!.revs['runnerQueue:1']).toBe('0');
    }
  });

  it('narrows the queue to the project it is read in', async () => {
    const { api, project, agent } = await setup();
    const other = (
      await api.teams({ teamId: project.teamId }).projects.post({ key: 'OTH', name: 'Other' })
    ).data!;
    await api
      .teams({ teamId: project.teamId })
      ['ai-agents']({ agentId: agent.id })
      .projects.put({ projectIds: [project.id, other.id] });
    const columnId = (await api.projects({ projectKey: 'OTH' }).get()).data!.columns[0].id;
    const issue = (
      await api.projects({ projectKey: 'OTH' }).issues.post({ columnId, title: 'Elsewhere' })
    ).data!;
    await api.issues({ issueId: issue.id }).comments.post({ body: '@runner other work' });
    const projectQueue = api.projects({ projectKey: 'RUN' })['agent-runs'].queue;

    const all = (await api['agent-runs'].queue.get()).data!;
    const own = (await projectQueue.get()).data!;
    expect(all.total).toBe(2);
    expect(own).toMatchObject({ total: 1, queued: 1 });
    expect(own.items[0].issueTitle).toBe('Run this');
    const elsewhere = all.items.find((run) => run.issueTitle === 'Elsewhere')!;
    expect((await projectQueue.get({ query: { runId: elsewhere.id } })).data!.total).toBe(0);

    const role = (
      await createRole(api, 'RUN', { name: 'Items', permissions: { work_items: { read: true } } })
    ).data!;
    const member = await addProjectMember(api, 'RUN', role.id);
    expect((await member.projects({ projectKey: 'RUN' })['agent-runs'].queue.get()).status).toBe(
      403,
    );
  });

  it('paginates with stable id ordering and lists internal agents without a runner', async () => {
    const { api, issue, runner } = await setup();
    await api.issues({ issueId: issue.id }).comments.post({ body: '@runner second run' });
    await createAgent(api, 'RUN', {
      name: 'Internal',
      username: 'internal',
      kind: 'internal',
      triggerOnMention: true,
    });
    await api.issues({ issueId: issue.id }).comments.post({ body: '@internal internal work' });
    const first = (await api['agent-runs'].queue.get({ query: { page: 1, pageSize: 1 } })).data!;
    const second = (await api['agent-runs'].queue.get({ query: { page: 2, pageSize: 1 } })).data!;
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    expect(first.items[0].id).not.toBe(second.items[0].id);
    expect((await api['agent-runs'].queue.get()).data!.items).toContainEqual(
      expect.objectContaining({
        kind: 'internal',
        username: 'internal',
        runnerState: null,
        executionState: 'queued',
      }),
    );
    const claimed = (await runner['agent-runs'].claim.post()).data!.run!;
    const activeFirst = (await api['agent-runs'].queue.get({ query: { pageSize: 1 } })).data!;
    expect(activeFirst.items[0]).toMatchObject({ id: claimed.id, executionState: 'running' });
    expect((await api['agent-runs'].queue.get({ query: { page: 1.5 } })).status).toBe(400);
    expect((await api['agent-runs'].queue.get({ query: { pageSize: 101 } })).status).toBe(400);
  });

  it('includes a scheduled manual run that has no issue', async () => {
    const { api, agent } = await setup();
    const schedule = await api.projects({ projectKey: 'RUN' })['agent-schedules'].post({
      agentId: agent.id,
      name: 'Daily',
      cron: '0 9 * * *',
      prompt: 'Daily work',
    });
    expect(schedule.status).toBe(201);
    const queued = await api
      .projects({ projectKey: 'RUN' })
      ['agent-schedules']({ scheduleId: schedule.data!.id })
      .run.post();
    expect(queued.status).toBe(202);
    const queue = (await api['agent-runs'].queue.get()).data!;
    expect(queue.items).toContainEqual(
      expect.objectContaining({
        id: queued.data!.runId,
        issueId: null,
        scheduleName: 'Daily',
        trigger: 'manual',
        executionState: 'queued',
      }),
    );
  });

  it('reports an agent with an invocation URL as push instead of runner presence', async () => {
    const { api, agent } = await setup();
    // The SSRF guard refuses a loopback URL under NODE_ENV=test.
    const environment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const patched = await api
        .teams({ teamId: await teamOf(api, 'RUN') })
        ['ai-agents']({ agentId: agent.id })
        .patch({ invocationUrl: 'http://127.0.0.1:9/agent' });
      expect(patched.status).toBe(200);
    } finally {
      process.env.NODE_ENV = environment;
    }
    expect((await api['agent-runs'].queue.get()).data!.items[0]).toMatchObject({
      executionState: 'queued',
      runnerState: 'push',
    });
  });

  it('removes canceled runs after their issue moves', async () => {
    const { api, project, issue } = await setup();
    const other = (
      await api.teams({ teamId: project.teamId }).projects.post({ key: 'NEXT', name: 'Next' })
    ).data!;
    const moved = await api.issues({ issueId: issue.id }).move.post({ projectId: other.id });
    expect(moved.status).toBe(200);
    expect((await api['agent-runs'].queue.get()).data!.total).toBe(0);
  });

  it('shows a run started in a document only to whoever may read the document', async () => {
    const { api } = await setup();
    const documents = api.projects({ projectKey: 'RUN' }).documents;
    const created = (
      await documents.post({
        title: 'Plan',
        content: 'Hello world',
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
        },
      })
    ).data!;
    const doc = documents({ documentId: created.id });
    const root = (
      await doc.comments.post({
        body: 'Why?',
        quote: 'Hello',
        from: 1,
        to: 6,
        version: created.version,
      })
    ).data!;
    await doc.comments.post({ parentId: root.id, body: '@runner summarise' });
    const documentRuns = async (viewer: typeof api) =>
      (await viewer['agent-runs'].queue.get()).data!.items.filter(
        (item) => item.prompt === '@runner summarise',
      );
    const [run] = await documentRuns(api);
    expect(run).toBeDefined();

    const blindRole = await createRole(api, 'RUN', {
      name: 'No documents',
      permissions: { work_items: { read: true }, ai_agents: { read: true } },
    });
    const readerRole = await createRole(api, 'RUN', {
      name: 'Documents too',
      permissions: {
        work_items: { read: true },
        ai_agents: { read: true },
        documents: { read: true },
      },
    });
    const blind = await addProjectMember(api, 'RUN', blindRole.data!.id);
    const reader = await addProjectMember(api, 'RUN', readerRole.data!.id);

    expect(await documentRuns(blind)).toHaveLength(0);
    expect((await blind['agent-runs']({ runId: run.id }).trace.get()).status).toBe(403);
    expect(await documentRuns(reader)).toHaveLength(1);
    expect((await reader['agent-runs']({ runId: run.id }).trace.get()).status).toBe(200);

    const { version } = (await doc.get()).data!;
    expect((await doc.access.post({ version, isPrivate: true })).status).toBe(200);
    expect(await documentRuns(reader)).toHaveLength(0);
    expect((await reader['agent-runs']({ runId: run.id }).trace.get()).status).toBe(404);
    expect(await documentRuns(api)).toHaveLength(1);
  });
});
