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

async function createTask(api: Api, projectKey: string, title: string, description = '') {
  const board = (await api.projects({ projectKey }).get()).data!;
  const created = await api.projects({ projectKey }).issues.post({
    title,
    description,
    columnId: board.columns[0].id,
  });
  expect(created.status).toBe(201);
  return created.data!;
}

describe('workspace discovery', () => {
  beforeEach(resetDb);

  it('finds projects with every term across key, name, and description', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'API', name: 'Agent console', description: 'OAuth callback' });
    await api.projects.post({ key: 'OTHER', name: 'Agent console', description: 'Other work' });

    const found = await api.discovery.search.get({
      query: { q: '  CALLBACK api AGENT ', kind: 'projects' },
    });
    expect(found.status).toBe(200);
    expect(found.data).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 25,
      items: [{ kind: 'project', projectKey: 'API', title: 'Agent console' }],
    });
    expect(found.data!.items[0]).not.toHaveProperty('description');
    expect(found.data!.items[0]).not.toHaveProperty('permissions');
  });

  it('finds tasks without a project key and returns their project and current state', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'API', name: 'Agent console' });
    await api.projects.post({ key: 'WEB', name: 'Website' });
    const task = await createTask(api, 'API', 'Repair callback', 'Handle OAuth state');
    await createTask(api, 'WEB', 'Repair callback', 'Unrelated request');

    const found = await api.discovery.search.get({
      query: { q: 'oauth callback', kind: 'issues' },
    });
    expect(found.status).toBe(200);
    expect(found.data).toMatchObject({
      total: 1,
      items: [
        {
          kind: 'issue',
          id: task.id,
          identifier: task.identifier,
          projectKey: 'API',
          projectName: 'Agent console',
          columnId: task.columnId,
          archived: false,
        },
      ],
    });
    const hit = found.data!.items[0];
    expect(hit.kind === 'issue' && hit.stateType).toBeString();
    expect(hit).not.toHaveProperty('description');
    expect(hit).not.toHaveProperty('fieldValues');
    const byProjectName = await api.discovery.search.get({
      query: { q: 'console callback', kind: 'issues' },
    });
    expect(byProjectName.data?.items.map((item) => item.id)).toEqual([task.id]);
  });

  it('ranks exact project keys and issue identifiers first and includes archived tasks', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'EXACT', name: 'Actual project' });
    await api.projects.post({ key: 'A', name: 'EXACT' });
    const task = await createTask(api, 'EXACT', 'Release work');
    await createTask(api, 'A', task.identifier);
    expect((await api.issues({ issueId: task.id }).archive.post()).status).toBe(200);

    const projects = await api.discovery.search.get({ query: { q: 'exact', kind: 'projects' } });
    expect(projects.data?.items.map((item) => item.projectKey)).toEqual(['EXACT', 'A']);
    const issues = await api.discovery.search.get({ query: { q: task.identifier.toLowerCase() } });
    expect(issues.data?.items[0]).toMatchObject({ kind: 'issue', id: task.id, archived: true });
    expect(issues.data?.total).toBe(2);
  });

  it('puts task titles ahead of description matches on a small first page', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'A', name: 'Background research' });
    await api.projects.post({ key: 'Z', name: 'Product work' });
    for (let index = 0; index < 5; index++) {
      await createTask(api, 'A', `Research item ${index}`, 'Notes about agent discovery');
    }
    const relevant = await createTask(api, 'Z', 'Improve agent workspace discovery');
    const found = await api.discovery.search.get({
      query: { q: 'agent discovery', kind: 'issues', pageSize: 5 },
    });
    expect(found.status).toBe(200);
    expect(found.data?.total).toBe(6);
    expect(found.data!.items[0]).toMatchObject({ id: relevant.id, projectKey: 'Z' });
  });

  it('puts project names ahead of description matches', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'A', name: 'Background', description: 'Agent discovery' });
    await api.projects.post({ key: 'Z', name: 'Agent workspace discovery' });
    const found = await api.discovery.search.get({
      query: { q: 'agent discovery', kind: 'projects', pageSize: 1 },
    });
    expect(found.status).toBe(200);
    expect(found.data).toMatchObject({ total: 2, items: [{ projectKey: 'Z' }] });
  });

  it('matches SQL wildcard characters literally', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'PCT', name: '100% ready' });
    await api.projects.post({ key: 'UNDER', name: 'under_score' });
    await api.projects.post({ key: 'SLASH', name: 'back\\slash' });
    await api.projects.post({ key: 'OTHER', name: 'ordinary' });
    await createTask(api, 'PCT', '50% off');
    await createTask(api, 'UNDER', 'under_score');
    await createTask(api, 'SLASH', 'back\\slash');
    for (const [q, key] of [
      ['%', 'PCT'],
      ['_', 'UNDER'],
      ['\\', 'SLASH'],
    ]) {
      const found = await api.discovery.search.get({ query: { q } });
      expect(found.status).toBe(200);
      expect(found.data?.total).toBe(2);
      expect(found.data?.items.every((item) => item.projectKey === key)).toBe(true);
    }
  });

  it('pages one combined result set and counts matches beyond the last page', async () => {
    const { api } = await setup();
    for (const key of ['A', 'B', 'C']) {
      await api.projects.post({ key, name: 'Shared project' });
      await createTask(api, key, 'Shared task');
    }
    const ids: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      const found = await api.discovery.search.get({ query: { q: 'shared', page, pageSize: 2 } });
      expect(found.status).toBe(200);
      expect(found.data).toMatchObject({ total: 6, page, pageSize: 2 });
      expect(found.data!.items).toHaveLength(page === 4 ? 0 : 2);
      ids.push(...found.data!.items.map((item) => `${item.kind}:${item.id}`));
    }
    expect(new Set(ids).size).toBe(6);
    const missing = await api.discovery.search.get({ query: { q: 'missing' } });
    expect(missing.data).toMatchObject({ total: 0, items: [] });
  });

  it('combines project and team filters', async () => {
    const { api } = await setup();
    const first = (await api.projects.post({ key: 'A', name: 'Shared project' })).data!;
    const secondTeam = (await api.teams.post({ name: 'Other team', slug: 'other-team' })).data!;
    await api.teams({ teamId: secondTeam.id }).projects.post({ key: 'B', name: 'Shared project' });
    await createTask(api, 'A', 'Shared task');
    await createTask(api, 'B', 'Shared task');
    const found = await api.discovery.search.get({
      query: { q: 'shared', projectKey: ' a ', teamId: first.teamId },
    });
    expect(found.data?.total).toBe(2);
    expect(found.data?.items.every((item) => item.projectKey === 'A')).toBe(true);
    const mismatch = await api.discovery.search.get({
      query: { q: 'shared', projectKey: 'A', teamId: secondTeam.id },
    });
    expect(mismatch.data).toMatchObject({ total: 0, items: [] });
  });

  it('names each project by its ref and filters by key or ref', async () => {
    const { api } = await setup();
    const first = (await api.projects.post({ key: 'MKT', name: 'Shared project' })).data!;
    const second = (await api.teams.post({ name: 'Second', slug: 'second' })).data!;
    await api.teams({ teamId: second.id }).projects.post({ key: 'MKT', name: 'Shared project' });
    await createTask(api, first.ref, 'Shared task');
    await createTask(api, 'second.MKT', 'Shared task');

    const both = await api.discovery.search.get({ query: { q: 'shared', projectKey: 'mkt' } });
    expect(both.data?.total).toBe(4);
    expect(new Set(both.data!.items.map((item) => item.projectRef))).toEqual(
      new Set([first.ref, 'second.MKT']),
    );
    const one = await api.discovery.search.get({
      query: { q: 'shared', projectKey: 'Second.mkt' },
    });
    expect(one.data?.total).toBe(2);
    expect(one.data!.items.every((item) => item.projectRef === 'second.MKT')).toBe(true);
  });

  it('keeps task content and match counts behind work-item read permission', async () => {
    const { api } = await setup();
    await api.projects.post({ key: 'SECRET', name: 'Shared project' });
    await createTask(api, 'SECRET', 'Confidential task', 'Private token');
    const role = await createRole(api, 'SECRET', { name: 'Documents only', permissions: {} });
    const member = await addProjectMember(api, 'SECRET', role.data!.id);
    const projects = await member.discovery.search.get({ query: { q: 'shared' } });
    expect(projects.data).toMatchObject({
      total: 1,
      items: [{ kind: 'project', projectKey: 'SECRET' }],
    });
    for (const q of ['confidential', 'private', 'SECRET']) {
      const found = await member.discovery.search.get({ query: { q, kind: 'issues' } });
      expect(found.data).toMatchObject({ total: 0, items: [] });
    }
    const outsider = await setup();
    const found = await outsider.api.discovery.search.get({
      query: { q: 'shared', teamId: projects.data!.items[0].teamId },
    });
    expect(found.data).toMatchObject({ total: 0, items: [] });
  });

  it('exposes a read-only MCP tool and filters disabled projects and teams before paging', async () => {
    const { user, api } = await setup();
    const on = (await api.projects.post({ key: 'ON', name: 'Visible project' })).data!;
    const off = (await api.projects.post({ key: 'OFF', name: 'Visible project' })).data!;
    const secondTeam = (await api.teams.post({ name: 'Other team', slug: 'other-team' })).data!;
    await api
      .teams({ teamId: secondTeam.id })
      .projects.post({ key: 'TEAMOFF', name: 'Visible project' });
    for (const key of ['ON', 'OFF', 'TEAMOFF']) await createTask(api, key, 'Visible task');
    await api
      .teams({ teamId: on.teamId })
      .mcp.patch({ projects: [{ projectId: off.id, enabled: false }] });
    await api.teams({ teamId: secondTeam.id }).mcp.patch({ enabled: false });

    const tool = routeTools(app).find((item) => item.name === 'search_workspace')!;
    expect(tool.annotations.readOnlyHint).toBe(true);
    expect(tool.inputSchema.required).toEqual(['q']);
    const { key } = await auth.api.createApiKey({
      body: { userId: user.userId, name: 'discovery' },
    });
    const found = await dispatchTool(
      app,
      tool,
      { q: 'visible' },
      { kind: 'api-key', apiKey: key },
      { viaMcpEndpoint: true },
    );
    expect(found.isError).toBe(false);
    const result = JSON.parse(found.text);
    expect(result.total).toBe(2);
    expect(result.items.every((item: { projectKey: string }) => item.projectKey === 'ON')).toBe(
      true,
    );
    expect((await api.discovery.search.get({ query: { q: 'visible' } })).data?.total).toBe(6);
  });

  it('rejects missing, blank, or excessive queries and invalid filters or pages', async () => {
    const { user } = await setup();
    for (const query of [
      '',
      'q=',
      'q=%20%20',
      `q=${'a'.repeat(201)}`,
      'q=test&kind=notes',
      'q=test&teamId=0',
      'q=test&teamId=1.5',
      'q=test&page=0',
      'q=test&page=1.5',
      'q=test&pageSize=51',
      'q=test&pageSize=0',
      'q=test&pageSize=1.5',
    ]) {
      const response = await app.handle(
        new Request(`http://localhost/discovery/search?${query}`, {
          headers: { cookie: user.cookie },
        }),
      );
      expect(response.status).toBe(400);
    }
  });
});
