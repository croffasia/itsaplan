import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';
import { dispatchTool } from '#mcp/dispatch';
import { routeTools } from '#mcp/generate';

async function setup() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

async function createWorkItem(api: Api, projectKey: string) {
  const board = await api.projects({ projectKey }).get();
  const created = await api.projects({ projectKey }).issues.post({
    title: 'Work item',
    columnId: board.data!.columns[0].id,
  });
  expect(created.status).toBe(201);
  return created.data!;
}

describe('project discovery', () => {
  beforeEach(resetDb);

  it('searches key, name, and description without treating SQL wildcards as patterns', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'ALPHA', name: 'Research', description: 'Release readiness' });
    await api.projects.post({ key: 'PCT', name: '100% ready' });
    await api.projects.post({ key: 'UNDER', name: 'under_score' });
    await api.projects.post({ key: 'SLASH', name: 'back\\slash' });

    for (const [q, expected] of [
      ['  alpha  ', ['ALPHA']],
      ['SEARCH', ['ALPHA']],
      ['readiness', ['ALPHA']],
      ['%', ['PCT']],
      ['_', ['UNDER']],
      ['\\', ['SLASH']],
      ['missing', []],
    ] as const) {
      const result = await api.projects.get({ query: { q } });
      expect(result.status).toBe(200);
      expect(result.data?.map((p) => p.key)).toEqual([...expected]);
    }
    const all = await api.projects.get({ query: { q: '   ' } });
    expect(all.data?.map((p) => p.key)).toEqual(['ALPHA', 'PCT', 'SLASH', 'UNDER']);
  });

  it('sorts by name and newest creation, with stable key ordering for equal names', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'Z', name: 'Alpha' });
    await api.projects.post({ key: 'B', name: 'alpha' });
    await api.projects.post({ key: 'A', name: 'Zulu' });

    const byName = await api.projects.get({ query: { sort: 'name' } });
    expect(byName.status).toBe(200);
    expect(byName.data?.map((p) => p.key)).toEqual(['B', 'Z', 'A']);
    const byCreated = await api.projects.get({ query: { sort: 'created' } });
    expect(byCreated.status).toBe(200);
    expect(byCreated.data?.map((p) => p.key)).toEqual(['A', 'B', 'Z']);
  });

  it('orders activity by work-item changes and comments, leaving empty projects last by key', async () => {
    const { api } = await setup();
    for (const key of ['ZEMPTY', 'B', 'A', 'AEMPTY']) {
      await api.projects.post({ key, name: key });
    }
    const first = await createWorkItem(api, 'A');
    await createWorkItem(api, 'B');
    const before = await api.projects.get({ query: { sort: 'activity' } });
    expect(before.data?.map((p) => p.key)).toEqual(['B', 'A', 'AEMPTY', 'ZEMPTY']);

    const comment = await api
      .issues({ issueId: first.id })
      .comments.post({ body: 'Latest change' });
    expect(comment.status).toBe(201);
    const after = await api.projects.get({ query: { sort: 'activity', permissions: 'true' } });
    expect(after.status).toBe(200);
    expect(after.data?.map((p) => p.key)).toEqual(['A', 'B', 'AEMPTY', 'ZEMPTY']);
    expect(after.data?.[0].lastActivityAt).toEqual(comment.data!.createdAt);
    expect(after.data?.[0].permissions).toMatchObject({ work_items: { read: true } });
    expect(after.data?.slice(2).map((p) => p.lastActivityAt)).toEqual([null, null]);

    const updated = await api.issues({ issueId: first.id }).patch({ title: 'Updated work item' });
    expect(updated.status).toBe(200);
    const feed = await api.issues({ issueId: first.id }).feed.get();
    const current = await api.projects.get({ query: { sort: 'activity' } });
    expect(current.data?.[0].lastActivityAt).toEqual(feed.data!.items[0].createdAt);
  });

  it('keeps private document changes out of the activity timestamp', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'DOC', name: 'Documents' });
    const member = await addProjectMember(api, 'DOC');
    const created = await api.projects({ projectKey: 'DOC' }).documents.post({
      title: 'Private planning',
      isPrivate: true,
    });
    expect(created.status).toBe(201);
    const listed = await member.projects.get({ query: { sort: 'activity' } });
    expect(listed.status).toBe(200);
    expect(listed.data).toMatchObject([{ key: 'DOC', lastActivityAt: null }]);
  });

  it('does not expose or sort by activity when the member cannot read work items', async () => {
    const { api } = await setup();
    for (const key of ['A', 'B']) await api.projects.post({ key, name: key });
    const role = await createRole(api, 'A', { name: 'Documents only', permissions: {} });
    const user = await signUpTestUser();
    const member = authedApi(user.cookie);
    const invited = await api.projects({ projectKey: 'A' }).invites.post({
      email: user.email,
      role: 'member',
      roleId: role.data!.id,
    });
    expect(invited.status).toBe(201);
    expect((await member.invites({ token: invited.data!.token }).accept.post()).status).toBe(200);
    const joined = await api.projects({ projectKey: 'B' }).members.post({
      userId: user.userId,
      role: 'member',
      roleId: role.data!.id,
    });
    expect(joined.status).toBe(204);
    await createWorkItem(api, 'B');
    const listed = await member.projects.get({ query: { sort: 'activity', permissions: 'true' } });
    expect(listed.status).toBe(200);
    expect(listed.data?.map((p) => p.key)).toEqual(['A', 'B']);
    expect(listed.data?.map((p) => p.lastActivityAt)).toEqual([null, null]);
    expect(listed.data?.[0].permissions).toMatchObject({ work_items: { read: false } });
  });

  it('combines team and search filters without revealing projects to a non-member', async () => {
    const { api } = await setup();
    const first = (await api.projects.post({ key: 'ONE', name: 'Shared name' })).data!;
    const team = (await api.teams.post({ name: 'Second team' })).data!;
    const second = await api.teams({ teamId: team.id }).projects.post({
      key: 'TWO',
      name: 'Shared name',
    });
    expect(second.status).toBe(201);

    const query = { q: 'shared', teamId: team.id, sort: 'activity' as const };
    const listed = await api.projects.get({ query });
    expect(listed.status).toBe(200);
    expect(listed.data?.map((p) => p.key)).toEqual(['TWO']);
    const other = await setup();
    expect((await other.api.projects.get({ query })).data).toEqual([]);
    expect((await other.api.projects.get({ query: { teamId: first.teamId } })).data).toEqual([]);
  });

  it('rejects invalid sort values and non-positive or fractional team IDs', async () => {
    const { user } = await setup();
    for (const query of ['sort=unknown', 'teamId=0', 'teamId=-1', 'teamId=1.5']) {
      const result = await app.handle(
        new Request(`http://localhost/projects?${query}`, { headers: { cookie: user.cookie } }),
      );
      expect(result.status).toBe(400);
    }
  });

  it('exposes discovery arguments over MCP and preserves both MCP opt-in switches', async () => {
    const { user, api } = await setup();
    const on = (await api.projects.post({ key: 'ON', name: 'Visible project' })).data!;
    const off = (await api.projects.post({ key: 'OFF', name: 'Visible disabled project' })).data!;
    const secondTeam = (await api.teams.post({ name: 'Closed team' })).data!;
    await api
      .teams({ teamId: secondTeam.id })
      .projects.post({ key: 'TEAMOFF', name: 'Visible team' });
    await api.teams({ teamId: on.teamId }).mcp.patch({
      projects: [{ projectId: off.id, enabled: false }],
    });
    await api.teams({ teamId: secondTeam.id }).mcp.patch({ enabled: false });

    const tool = routeTools(app).find((item) => item.name === 'list_projects')!;
    expect(Object.keys(tool.inputSchema.properties)).toEqual(
      expect.arrayContaining(['q', 'sort', 'teamId', 'permissions']),
    );
    expect(tool.inputSchema.required).toEqual([]);
    expect(tool.annotations.readOnlyHint).toBe(true);
    const { key } = await auth.api.createApiKey({
      body: { userId: user.userId, name: 'discovery' },
    });
    const call = (args: Record<string, unknown>) =>
      dispatchTool(app, tool, args, { kind: 'api-key', apiKey: key }, { viaMcpEndpoint: true });
    const filtered = await call({ q: 'VISIBLE', sort: 'activity', permissions: 'true' });
    expect(filtered.isError).toBe(false);
    expect(JSON.parse(filtered.text)).toMatchObject([
      { key: 'ON', lastActivityAt: null, permissions: { work_items: { read: true } } },
    ]);
    expect(JSON.parse(filtered.text)).toHaveLength(1);
    expect(JSON.parse((await call({ teamId: secondTeam.id })).text)).toEqual([]);
    expect((await call({ sort: 'unknown' })).isError).toBe(true);
    expect((await api.projects.get()).data).toHaveLength(3);

    const outsider = await setup();
    const outsiderKey = await auth.api.createApiKey({
      body: { userId: outsider.user.userId, name: 'outsider' },
    });
    const hidden = await dispatchTool(
      app,
      tool,
      { q: 'Visible', teamId: on.teamId, sort: 'activity' },
      { kind: 'api-key', apiKey: outsiderKey.key },
      { viaMcpEndpoint: true },
    );
    expect(hidden.isError).toBe(false);
    expect(JSON.parse(hidden.text)).toEqual([]);
  });
});
