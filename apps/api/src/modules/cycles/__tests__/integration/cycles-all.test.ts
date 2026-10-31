import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';

// GET /cycles: the cycles of every project the caller may read cycles in.

function day(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function setup() {
  await signUpTestUser();
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  await createProject(api, { key: 'OPS', name: 'Operations' });
  return { user, api };
}

function createCycle(api: Api, projectKey: string, name: string, start: number, end: number) {
  return api
    .projects({ projectKey })
    .cycles.post({ name, startDate: day(start), endDate: day(end) });
}

const projectId = async (api: Api, projectKey: string) =>
  (await api.projects({ projectKey }).get()).data!.project.id;

const names = (res: Awaited<ReturnType<Api['cycles']['get']>>) => res.data?.map((c) => c.name);

describe('cross-project cycle list', () => {
  beforeEach(resetDb);

  it('lists the cycles of every project oldest first, each with its project', async () => {
    const { api } = await setup();
    await createCycle(api, 'MKT', 'MKT current', 0, 6);
    await createCycle(api, 'OPS', 'OPS past', -20, -14);
    await createCycle(api, 'OPS', 'OPS next', 7, 13);

    const res = await api.cycles.get();
    const [ownTeam] = (await api.teams.get()).data!;
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['OPS past', 'MKT current', 'OPS next']);
    expect(res.data![1]).toMatchObject({
      status: 'active',
      projectId: await projectId(api, 'MKT'),
      projectKey: 'MKT',
      projectName: 'Marketing',
      projectRef: expect.stringMatching(/\.MKT$/),
      teamName: ownTeam!.name,
      progress: { completed: 0, canceled: 0, total: 0 },
    });
    expect(names(await api.cycles.get({ query: { status: 'planned' } }))).toEqual([
      'MKT current',
      'OPS next',
    ]);
  });

  it("leaves out another person's projects", async () => {
    const { api } = await setup();
    await createCycle(api, 'MKT', 'Secret', 0, 6);
    const other = authedApi((await signUpTestUser()).cookie);

    const res = await other.cycles.get();
    expect(res.status).toBe(200);
    expect(res.data).toEqual([]);
  });

  it('leaves out a project whose role may not read cycles', async () => {
    const { api } = await setup();
    await createCycle(api, 'MKT', 'MKT cycle', 0, 6);
    const reader = await createRole(api, 'MKT', {
      name: 'Reader',
      permissions: { cycles: { read: true } },
    });
    const blind = await createRole(api, 'MKT', { name: 'Blind', permissions: {} });

    expect(names(await (await addProjectMember(api, 'MKT', reader.data!.id)).cycles.get())).toEqual(
      ['MKT cycle'],
    );
    expect(names(await (await addProjectMember(api, 'MKT', blind.data!.id)).cycles.get())).toEqual(
      [],
    );
  });

  it('leaves out a project with cycles turned off', async () => {
    const { api } = await setup();
    await createCycle(api, 'MKT', 'MKT cycle', 0, 6);
    await createCycle(api, 'OPS', 'OPS cycle', 0, 6);
    await api.projects({ projectKey: 'OPS' }).settings.patch({ features: { cycles: false } });

    expect(names(await api.cycles.get())).toEqual(['MKT cycle']);
  });

  it('lists only the project an agent run is bound to', async () => {
    const { user, api } = await setup();
    await createCycle(api, 'MKT', 'MKT cycle', 0, 6);
    await createCycle(api, 'OPS', 'OPS cycle', 0, 6);
    const other = authedApi((await signUpTestUser()).cookie);
    await createProject(other, { key: 'HR', name: 'People' });
    const bound = (id: number) => authedApi(user.cookie, { 'x-agent-project': String(id) });

    expect(names(await bound(await projectId(api, 'MKT')).cycles.get())).toEqual(['MKT cycle']);
    expect(names(await bound(await projectId(other, 'HR')).cycles.get())).toEqual([]);
  });

  it('rejects an unknown status', async () => {
    const { user } = await setup();
    const res = await app.handle(
      new Request('http://localhost/cycles?status=done', { headers: { cookie: user.cookie } }),
    );
    expect(res.status).toBe(400);
  });

  it('serves the list_cycles_all_projects MCP tool over the MCP-enabled projects', async () => {
    const { user, api } = await setup();
    await createCycle(api, 'MKT', 'Visible', 0, 6);
    await createCycle(api, 'OPS', 'Hidden', 0, 6);
    const ops = (await api.projects({ projectKey: 'OPS' }).get()).data!.project;
    await api.teams({ teamId: ops.teamId }).mcp.patch({
      projects: [{ projectId: ops.id, enabled: false }],
    });
    const key = await auth.api.createApiKey({ body: { userId: user.userId, name: 'cycles' } });

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
          params: { name: 'list_cycles_all_projects', arguments: {} },
        }),
      }),
    );
    const text = await response.text();
    const { result } = JSON.parse(text.slice(text.indexOf('data: ') + 6)) as {
      result: { structuredContent: { ok: boolean; data: { name: string }[] } };
    };
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ name: 'Visible', projectKey: 'MKT' })],
    });
    expect(result.structuredContent.data).toHaveLength(1);
  });
});
