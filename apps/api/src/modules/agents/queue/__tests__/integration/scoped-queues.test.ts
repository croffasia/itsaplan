import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { claimDueRuns, enqueueAgentRun } from '../../../core/run-queue';

// The run queue of a team, over its projects, and of a workspace, over the projects of
// every team of it.

type Api = ReturnType<typeof authedApi>;

// Queues a run of a new internal agent on an issue of the project.
async function queueRun(api: Api, projectKey: string, title: string) {
  const agent = (
    await createAgent(api, projectKey, { name: title, username: title, kind: 'internal' })
  ).data!.agent;
  const columnId = (await api.projects({ projectKey }).get()).data!.columns[0].id;
  const issue = (await api.projects({ projectKey }).issues.post({ columnId, title })).data!;
  await enqueueAgentRun({
    agentId: agent.id,
    projectId: agent.projects[0].id,
    issueId: issue.id,
    sourceActivityId: null,
    prompt: title,
  });
}

// A workspace with two teams, a project and a queued run in each.
async function setup() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  const workspaceId = owner.workspaceId!;
  const [first] = (await api.teams.get()).data!;
  const second = (await api.teams.post({ name: 'Second', slug: 'second', workspaceId })).data!;
  await createProject(api, { key: 'ONE', name: 'One' });
  await api.teams({ teamId: second.id }).projects.post({ key: 'TWO', name: 'Two' });
  await queueRun(api, 'ONE', 'first');
  await queueRun(api, 'TWO', 'second');
  return { api, workspaceId, teamId: first!.id };
}

const titles = (page: { items: { issueTitle: string | null }[] }) =>
  page.items.map((run) => run.issueTitle).sort();

describe('team and workspace run queues', () => {
  beforeEach(resetDb);

  it("lists a team's projects in its queue and every team's in the workspace's", async () => {
    const { api, workspaceId, teamId } = await setup();
    const elsewhere = authedApi((await signUpTestUser()).cookie);
    await createProject(elsewhere, { key: 'OUT', name: 'Out' });
    await queueRun(elsewhere, 'OUT', 'outside');

    const team = (await api.teams({ teamId })['agent-runs'].queue.get()).data!;
    const workspace = (await api.workspaces({ workspaceId })['agent-runs'].queue.get()).data!;
    expect(titles(team)).toEqual(['first']);
    expect(titles(workspace)).toEqual(['first', 'second']);
    expect(workspace).toMatchObject({ total: 2, queued: 2, running: 0 });
  });

  it('counts the runs in flight over the whole workspace from either', async () => {
    const { api, workspaceId, teamId } = await setup();
    await api.workspaces({ workspaceId }).patch({ maxConcurrentRuns: 3 });
    await claimDueRuns();

    const expected = { running: 2, limit: 3 };
    expect((await api.teams({ teamId })['agent-runs']['in-flight'].get()).data).toEqual(expected);
    expect((await api.workspaces({ workspaceId })['agent-runs']['in-flight'].get()).data).toEqual(
      expected,
    );
  });

  it('lets whoever runs the team read every run of it without a role in the project', async () => {
    const { api, teamId } = await setup();
    const manager = await signUpTestUser({ team: false });
    const invite = await api
      .teams({ teamId })
      .invites.post({ email: manager.email, role: 'manager' });
    const asManager = authedApi(manager.cookie);
    await asManager.invites({ token: invite.data!.token }).accept.post();

    const team = (await asManager.teams({ teamId })['agent-runs'].queue.get()).data!;
    expect(titles(team)).toEqual(['first']);
    const project = await asManager.projects({ projectKey: 'ONE' })['agent-runs'].queue.get();
    expect(project.status).toBe(200);
    expect(titles(project.data!)).toEqual(['first']);
    const runId = team.items[0]!.id;
    expect((await asManager['agent-runs']({ runId })['internal-trace'].get()).status).toBe(200);

    const marker = async () =>
      (await asManager.sync.rev.get({ query: { scopes: 'runnerQueue:1' } })).data!.revs[
        'runnerQueue:1'
      ];
    const before = await marker();
    await queueRun(api, 'ONE', 'later');
    expect(await marker()).not.toBe(before);
  });

  it('keeps the team queue to whoever runs the team or the workspace', async () => {
    const { api, workspaceId, teamId } = await setup();
    const role = (
      await createRole(api, 'ONE', {
        name: 'Agents',
        permissions: { work_items: { read: true }, ai_agents: { read: true } },
      })
    ).data!;
    const member = await addProjectMember(api, 'ONE', role.id);
    const admin = await signUpTestUser({ team: false });
    const invite = await api.teams({ teamId }).invites.post({ email: admin.email, role: 'member' });
    const asAdmin = authedApi(admin.cookie);
    await asAdmin.invites({ token: invite.data!.token }).accept.post();
    await api.workspaces({ workspaceId }).managers.post({ userId: admin.userId });

    expect(
      titles((await member.projects({ projectKey: 'ONE' })['agent-runs'].queue.get()).data!),
    ).toEqual(['first']);
    expect((await member.teams({ teamId })['agent-runs'].queue.get()).status).toBe(403);
    expect((await member.teams({ teamId })['agent-runs']['in-flight'].get()).status).toBe(403);
    expect((await member.workspaces({ workspaceId })['agent-runs'].queue.get()).status).toBe(404);
    expect((await member.workspaces({ workspaceId })['agent-runs']['in-flight'].get()).status).toBe(
      404,
    );
    expect(titles((await asAdmin.teams({ teamId })['agent-runs'].queue.get()).data!)).toEqual([
      'first',
    ]);
  });
});
