import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';

// GET /issues: the filtered issue list over every project the caller may read work items in.

async function setup() {
  await signUpTestUser();
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  await createProject(api, { key: 'OPS', name: 'Operations' });
  return { user, api };
}

async function columns(api: Api, projectKey: string) {
  return (await api.projects({ projectKey }).get()).data!.columns;
}

async function createIssue(
  api: Api,
  projectKey: string,
  title: string,
  body: Record<string, unknown> = {},
) {
  const columnId = (await columns(api, projectKey))[0]!.id;
  const res = await api.projects({ projectKey }).issues.post({ columnId, title, ...body });
  return res.data!;
}

type Query = NonNullable<NonNullable<Parameters<Api['issues']['get']>[0]>['query']>;

const list = (api: Api, query: Query = {}) => api.issues.get({ query });

const titles = (res: Awaited<ReturnType<typeof list>>) => res.data?.map((hit) => hit.title).sort();

describe('cross-project issue list', () => {
  beforeEach(resetDb);

  it('lists the issues of every project, newest update first, each with its project', async () => {
    const { api } = await setup();
    const mkt = await createIssue(api, 'MKT', 'Launch plan');
    const ops = await createIssue(api, 'OPS', 'Runbook');
    const archived = await createIssue(api, 'OPS', 'Old runbook');
    await api.issues({ issueId: archived.id }).archive.post();

    const res = await list(api);
    const [ownTeam] = (await api.teams.get()).data!;
    expect(res.status).toBe(200);
    expect(res.data!.map((hit) => hit.id)).toEqual([ops.id, mkt.id]);
    expect(res.data![1]).toMatchObject({
      identifier: `MKT-${mkt.sequenceNumber}`,
      projectKey: 'MKT',
      projectName: 'Marketing',
      projectRef: expect.stringMatching(/\.MKT$/),
      teamName: ownTeam!.name,
      archived: false,
    });
    expect(titles(await list(api, { includeArchived: 'true' }))).toEqual([
      'Launch plan',
      'Old runbook',
      'Runbook',
    ]);
  });

  it('filters by assignee, state type, cycle and parent', async () => {
    const { user, api } = await setup();
    await createIssue(api, 'MKT', 'Mine', { assigneeUserId: user.userId });
    await createIssue(api, 'OPS', 'Mine too', { assigneeUserId: user.userId });
    await createIssue(api, 'OPS', 'Unassigned');
    const done = await createIssue(api, 'MKT', 'Done');
    const doneColumn = (await columns(api, 'MKT')).find((c) => c.stateType === 'completed')!;
    await api.issues({ issueId: done.id }).patch({ columnId: doneColumn.id });
    const today = new Date().toISOString().slice(0, 10);
    const cycle = await api
      .projects({ projectKey: 'OPS' })
      .cycles.post({ name: 'Cycle 1', startDate: today, endDate: today });
    await createIssue(api, 'OPS', 'Planned', { cycleId: cycle.data!.id });
    const parent = await createIssue(api, 'MKT', 'Parent');
    await createIssue(api, 'MKT', 'Subtask', { parentId: parent.id });

    expect(titles(await list(api, { assigneeUserId: user.userId }))).toEqual(['Mine', 'Mine too']);
    expect(titles(await list(api, { stateTypes: 'completed' }))).toEqual(['Done']);
    expect(titles(await list(api, { stateTypes: 'backlog,unstarted,started' }))).not.toContain(
      'Done',
    );
    expect(titles(await list(api, { cycleIds: `${cycle.data!.id}` }))).toEqual(['Planned']);
    expect(titles(await list(api, { parentIds: `${parent.id},0` }))).toEqual(['Subtask']);
    expect(titles(await list(api, { assigneeUserId: '', cycleIds: '' }))).toHaveLength(7);
  });

  it('rejects an unknown state type', async () => {
    const { api } = await setup();
    const res = await list(api, { stateTypes: 'started,done' });
    expect(res.status).toBe(400);
  });

  it('caps the list at limit', async () => {
    const { api } = await setup();
    for (const title of ['One', 'Two', 'Three']) await createIssue(api, 'MKT', title);

    expect((await list(api, { limit: 2 })).data).toHaveLength(2);
  });

  it("leaves out another person's projects and a project whose role may not read work items", async () => {
    const { api } = await setup();
    await createIssue(api, 'MKT', 'Shared plan');
    const other = authedApi((await signUpTestUser()).cookie);
    const reader = await createRole(api, 'MKT', {
      name: 'Reader',
      permissions: { work_items: { read: true } },
    });
    const blind = await createRole(api, 'MKT', { name: 'Blind', permissions: {} });

    expect((await list(other)).data).toEqual([]);
    expect(titles(await list(await addProjectMember(api, 'MKT', reader.data!.id)))).toEqual([
      'Shared plan',
    ]);
    expect((await list(await addProjectMember(api, 'MKT', blind.data!.id))).data).toEqual([]);
  });

  it('lists only the project an agent run is bound to', async () => {
    const { user, api } = await setup();
    await createIssue(api, 'MKT', 'Launch plan');
    await createIssue(api, 'OPS', 'Runbook');
    const mkt = (await api.projects({ projectKey: 'MKT' }).get()).data!.project.id;

    const bound = authedApi(user.cookie, { 'x-agent-project': String(mkt) });
    expect(titles(await list(bound))).toEqual(['Launch plan']);
  });

  it('serves the list_issues_all_projects MCP tool over the MCP-enabled projects', async () => {
    const { user, api } = await setup();
    await createIssue(api, 'MKT', 'Visible plan');
    await createIssue(api, 'OPS', 'Hidden plan');
    const ops = (await api.projects({ projectKey: 'OPS' }).get()).data!.project;
    await api.teams({ teamId: ops.teamId }).mcp.patch({
      projects: [{ projectId: ops.id, enabled: false }],
    });
    const key = await auth.api.createApiKey({ body: { userId: user.userId, name: 'list' } });

    const response = await app.handle(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key.key}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_issues_all_projects', arguments: {} },
        }),
      }),
    );
    const text = await response.text();
    const { result } = JSON.parse(text.slice(text.indexOf('data: ') + 6)) as {
      result: { structuredContent: { ok: boolean; data: { title: string }[] } };
    };
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ title: 'Visible plan', projectKey: 'MKT' })],
    });
    expect(result.structuredContent.data).toHaveLength(1);
  });
});
