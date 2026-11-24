import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { db, team } from '@repo/db';
import { inArray } from 'drizzle-orm';
import { app, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';
import { emptyPermissions } from '#shared/permissions';
import { readOnlyPermissions, setWorkspaceRoleGrant } from '#shared/workspace-roles';

// GET /issues/search: text search over every project the caller may read work items in.

async function setup() {
  await signUpTestUser();
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  await createProject(api, { key: 'OPS', name: 'Operations' });
  return { user, api };
}

async function createIssue(api: Api, projectKey: string, title: string) {
  const view = await api.projects({ projectKey }).get();
  const res = await api
    .projects({ projectKey })
    .issues.post({ columnId: view.data!.columns[0]!.id, title });
  return res.data!;
}

function search(
  api: Api,
  query: { q: string; limit?: number; perProjectLimit?: number; excludeProjectId?: number },
) {
  return api.issues.search.get({ query });
}

const titles = (res: Awaited<ReturnType<typeof search>>) =>
  res.data?.map((hit) => hit.title).sort();

describe('cross-project issue search', () => {
  beforeEach(resetDb);
  afterEach(() => setWorkspaceRoleGrant('admin', readOnlyPermissions()));

  it('matches issues in every project of the caller, each with its project', async () => {
    const { api } = await setup();
    const mkt = await createIssue(api, 'MKT', 'Zephyr launch');
    await createIssue(api, 'OPS', 'Zephyr rollout');
    await createIssue(api, 'OPS', 'Unrelated');
    await api.issues({ issueId: mkt.id }).archive.post();

    const res = await search(api, { q: 'zephyr' });
    const [ownTeam] = (await api.teams.get()).data!;
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Zephyr launch', 'Zephyr rollout']);
    expect(res.data!.find((hit) => hit.id === mkt.id)).toMatchObject({
      identifier: `MKT-${mkt.sequenceNumber}`,
      projectKey: 'MKT',
      projectName: 'Marketing',
      projectRef: expect.stringMatching(/\.MKT$/),
      teamName: ownTeam!.name,
      archived: true,
    });
  });

  it('returns the estimate in points with each hit', async () => {
    const { api } = await setup();
    const sized = await createIssue(api, 'MKT', 'Zephyr launch');
    await api.issues({ issueId: sized.id }).patch({ estimatePoints: 1.5 });
    const bare = await createIssue(api, 'OPS', 'Zephyr rollout');

    const res = await search(api, { q: 'zephyr' });
    expect(res.data!.find((hit) => hit.id === sized.id)).toMatchObject({ estimatePoints: 1.5 });
    expect(res.data!.find((hit) => hit.id === bare.id)).toMatchObject({ estimatePoints: null });
  });

  it("leaves out another person's projects", async () => {
    const { api } = await setup();
    await createIssue(api, 'MKT', 'Secret plan');
    const other = authedApi((await signUpTestUser()).cookie);

    const res = await search(other, { q: 'secret' });
    expect(res.status).toBe(200);
    expect(res.data).toEqual([]);
  });

  it('leaves out a project whose role may not read work items', async () => {
    const { api } = await setup();
    await createIssue(api, 'MKT', 'Shared plan');
    await createIssue(api, 'OPS', 'Shared runbook');
    const reader = await createRole(api, 'MKT', {
      name: 'Reader',
      permissions: { work_items: { read: true } },
    });
    const blind = await createRole(api, 'OPS', { name: 'Blind', permissions: {} });
    const asReader = await addProjectMember(api, 'MKT', reader.data!.id);
    const asBlind = await addProjectMember(api, 'OPS', blind.data!.id);

    expect(titles(await search(asReader, { q: 'shared' }))).toEqual(['Shared plan']);
    expect(titles(await search(asBlind, { q: 'shared' }))).toEqual([]);
  });

  it('includes a project reached through a workspace role that reads work items', async () => {
    const owner = await signUpTestUser({ team: false });
    const lead = await signUpTestUser();
    const admin = await signUpTestUser();
    const asLead = authedApi(lead.cookie);
    const project = (await createProject(asLead, { key: 'MKT', name: 'Marketing' })).data!;
    await createIssue(asLead, 'MKT', 'Quarterly report');
    const asAdmin = authedApi(admin.cookie);
    const [adminTeam] = (await asAdmin.teams.get()).data!;
    await db
      .update(team)
      .set({ workspaceId: owner.workspaceId! })
      .where(inArray(team.id, [project.teamId, adminTeam!.id]));
    await authedApi(owner.cookie)
      .workspaces({ workspaceId: owner.workspaceId! })
      .managers.post({ userId: admin.userId });

    expect(titles(await search(authedApi(owner.cookie), { q: 'report' }))).toEqual([
      'Quarterly report',
    ]);
    expect(titles(await search(asAdmin, { q: 'report' }))).toEqual(['Quarterly report']);

    setWorkspaceRoleGrant('admin', emptyPermissions());
    expect(titles(await search(asAdmin, { q: 'report' }))).toEqual([]);
  });

  it('resolves "KEY-42" to that project, and a bare number to every project', async () => {
    const { api } = await setup();
    const mkt = await createIssue(api, 'MKT', 'First marketing');
    const ops = await createIssue(api, 'OPS', 'First operations');
    expect(ops.sequenceNumber).toBe(mkt.sequenceNumber);

    const keyed = await search(api, { q: `ops-${ops.sequenceNumber}` });
    expect(keyed.data!.map((hit) => hit.id)).toEqual([ops.id]);
    expect(titles(await search(api, { q: String(mkt.sequenceNumber) }))).toEqual([
      'First marketing',
      'First operations',
    ]);
  });

  it('caps the hits at limit and leaves out the excluded project', async () => {
    const { api } = await setup();
    const ops = await createIssue(api, 'OPS', 'Item four');
    for (const title of ['Item one', 'Item two', 'Item three']) {
      await createIssue(api, 'MKT', title);
    }
    const projectId = (await api.projects({ projectKey: 'MKT' }).get()).data!.project.id;

    const capped = await search(api, { q: 'item', limit: 2 });
    expect(capped.data!.map((hit) => hit.projectKey)).toEqual(['MKT', 'MKT']);
    expect((await search(api, { q: 'item', limit: 2, excludeProjectId: projectId })).data).toEqual([
      expect.objectContaining({ id: ops.id }),
    ]);
  });

  it('takes at most perProjectLimit hits from each project, five by default', async () => {
    const { api } = await setup();
    for (let i = 1; i <= 6; i++) await createIssue(api, 'MKT', `Report ${i}`);
    for (let i = 1; i <= 2; i++) await createIssue(api, 'OPS', `Report ops ${i}`);
    const keysOf = (res: Awaited<ReturnType<typeof search>>) =>
      res.data!.map((hit) => hit.projectKey).sort();

    expect(keysOf(await search(api, { q: 'report' }))).toEqual([
      ...Array<string>(5).fill('MKT'),
      'OPS',
      'OPS',
    ]);
    expect(keysOf(await search(api, { q: 'report', perProjectLimit: 2 }))).toEqual([
      'MKT',
      'MKT',
      'OPS',
      'OPS',
    ]);
    const newest = await search(api, { q: 'report', perProjectLimit: 2 });
    expect(newest.data!.find((hit) => hit.projectKey === 'MKT')!.title).toBe('Report 6');
    expect((await search(api, { q: 'report', limit: 3 })).data).toHaveLength(3);
  });

  it('searches only the project an agent run is bound to', async () => {
    const { user, api } = await setup();
    await createIssue(api, 'MKT', 'Zephyr launch');
    await createIssue(api, 'OPS', 'Zephyr rollout');
    const mkt = (await api.projects({ projectKey: 'MKT' }).get()).data!.project.id;
    const other = authedApi((await signUpTestUser()).cookie);
    await createProject(other, { key: 'HR', name: 'People' });
    const hr = (await other.projects({ projectKey: 'HR' }).get()).data!.project.id;
    const bound = (projectId: number) =>
      authedApi(user.cookie, { 'x-agent-project': String(projectId) });

    expect(titles(await search(bound(mkt), { q: 'zephyr' }))).toEqual(['Zephyr launch']);
    expect((await search(bound(hr), { q: 'zephyr' })).data).toEqual([]);
    expect(titles(await search(api, { q: 'zephyr' }))).toEqual(['Zephyr launch', 'Zephyr rollout']);
  });

  it('rejects an empty query', async () => {
    const { user } = await setup();
    const res = await app.handle(
      new Request('http://localhost/issues/search?q=', { headers: { cookie: user.cookie } }),
    );
    expect(res.status).toBe(400);
  });

  it('serves the search_issues_all_projects MCP tool over the MCP-enabled projects', async () => {
    const { user, api } = await setup();
    await createIssue(api, 'MKT', 'Older plan');
    await createIssue(api, 'MKT', 'Visible plan');
    await createIssue(api, 'OPS', 'Hidden plan');
    const ops = (await api.projects({ projectKey: 'OPS' }).get()).data!.project;
    await api.teams({ teamId: ops.teamId }).mcp.patch({
      projects: [{ projectId: ops.id, enabled: false }],
    });
    const key = await auth.api.createApiKey({ body: { userId: user.userId, name: 'search' } });

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
          params: {
            name: 'search_issues_all_projects',
            arguments: { q: 'plan', perProjectLimit: 1 },
          },
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
