import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';

async function setup() {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const created = await api.projects.post({ key: 'MKT', name: 'Marketing' });
  expect(created.status).toBe(201);
  return { user, api };
}

async function callTool(apiKey: string, name: string, args: Record<string, unknown> = {}) {
  const response = await app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  const { result } = JSON.parse(text.slice(text.indexOf('data: ') + 6)) as {
    result: { content: { text: string }[]; isError?: boolean };
  };
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0]!.text);
}

describe('personal project preferences', () => {
  beforeEach(resetDb);

  it('lists a new project with both personal preferences off', async () => {
    const { api } = await setup();

    const listed = await api.projects.get();
    expect(listed.status).toBe(200);
    expect(listed.data).toHaveLength(1);
    expect(listed.data?.[0]).toMatchObject({
      key: 'MKT',
      isFavorite: false,
      isHidden: false,
    });
  });

  it('updates each preference independently and accepts false to clear it', async () => {
    const { api } = await setup();
    const preferences = api.projects({ projectKey: 'MKT' }).preferences;

    const favorite = await preferences.patch({ isFavorite: true });
    expect(favorite.status).toBe(200);
    expect(favorite.data).toMatchObject({ isFavorite: true, isHidden: false });

    const hidden = await preferences.patch({ isHidden: true });
    expect(hidden.status).toBe(200);
    expect(hidden.data).toMatchObject({ isFavorite: true, isHidden: true });

    const unfavorite = await preferences.patch({ isFavorite: false });
    expect(unfavorite.status).toBe(200);
    expect(unfavorite.data).toMatchObject({ isFavorite: false, isHidden: true });
    expect((await api.projects.get()).data?.[0]).toMatchObject({
      key: 'MKT',
      isFavorite: false,
      isHidden: true,
    });

    const visible = await preferences.patch({ isHidden: false });
    expect(visible.status).toBe(200);
    expect(visible.data).toMatchObject({ isFavorite: false, isHidden: false });
    expect((await api.projects.get()).data?.[0]).toMatchObject({
      isFavorite: false,
      isHidden: false,
    });
  });

  it("keeps each member's preferences separate, including ordinary members", async () => {
    const { api } = await setup();
    const member = await addProjectMember(api, 'MKT');

    const ownerUpdate = await api
      .projects({ projectKey: 'MKT' })
      .preferences.patch({ isFavorite: true, isHidden: true });
    expect(ownerUpdate.status).toBe(200);
    expect((await member.projects.get()).data?.[0]).toMatchObject({
      key: 'MKT',
      isFavorite: false,
      isHidden: false,
    });

    const memberUpdate = await member
      .projects({ projectKey: 'MKT' })
      .preferences.patch({ isFavorite: true });
    expect(memberUpdate.status).toBe(200);
    expect(memberUpdate.data).toMatchObject({ isFavorite: true, isHidden: false });
    expect((await member.projects.get()).data?.[0]).toMatchObject({
      isFavorite: true,
      isHidden: false,
    });
    expect((await api.projects.get()).data?.[0]).toMatchObject({
      isFavorite: true,
      isHidden: true,
    });

    const members = await api.projects({ projectKey: 'MKT' }).members.get();
    expect(members.status).toBe(200);
    expect(members.data?.items).toHaveLength(2);
    for (const entry of members.data!.items) {
      expect(entry).not.toHaveProperty('isFavorite');
      expect(entry).not.toHaveProperty('isHidden');
    }
  });

  it('updates only the selected project', async () => {
    const { api } = await setup();
    const other = await api.projects.post({ key: 'OPS', name: 'Operations' });
    expect(other.status).toBe(201);

    const updated = await api
      .projects({ projectKey: 'MKT' })
      .preferences.patch({ isFavorite: true, isHidden: true });

    expect(updated.status).toBe(200);
    const listed = await api.projects.get();
    expect(listed.status).toBe(200);
    expect(listed.data).toMatchObject([
      { key: 'MKT', isFavorite: true, isHidden: true },
      { key: 'OPS', isFavorite: false, isHidden: false },
    ]);
  });

  it("denies a non-member and leaves the owner's preferences unchanged", async () => {
    const { api } = await setup();
    const outsider = authedApi((await signUpTestUser()).cookie);

    const update = await outsider
      .projects({ projectKey: 'MKT' })
      .preferences.patch({ isFavorite: true, isHidden: true });

    expect(update.status).toBe(403);
    expect((await api.projects.get()).data?.[0]).toMatchObject({
      isFavorite: false,
      isHidden: false,
    });
  });

  it('returns 404 for a project that does not exist', async () => {
    const { api } = await setup();

    const update = await api
      .projects({ projectKey: 'MISSING' })
      .preferences.patch({ isFavorite: true });

    expect(update.status).toBe(404);
  });

  it.each(['isFavorite', 'isHidden'] as const)('rejects a non-boolean %s', async (field) => {
    const { api } = await setup();

    const update = await api
      .projects({ projectKey: 'MKT' })
      .preferences.patch({ [field]: 'yes' } as never);

    expect(update.status).toBe(400);
    expect((await api.projects.get()).data?.[0]).toMatchObject({
      isFavorite: false,
      isHidden: false,
    });
  });

  it('rejects an empty preference update', async () => {
    const { api } = await setup();

    const update = await api.projects({ projectKey: 'MKT' }).preferences.patch({});

    expect(update.status).toBe(400);
  });

  it('keeps a hidden project listed and reachable through REST and MCP', async () => {
    const { user, api } = await setup();
    const key = await auth.api.createApiKey({
      body: { userId: user.userId, name: 'project-preferences' },
    });
    const update = await api.projects({ projectKey: 'MKT' }).preferences.patch({ isHidden: true });
    expect(update.status).toBe(200);

    const listed = await api.projects.get();
    expect(listed.status).toBe(200);
    expect(listed.data).toHaveLength(1);
    expect(listed.data?.[0]).toMatchObject({ key: 'MKT', isHidden: true });

    const project = await api.projects({ projectKey: 'MKT' }).get();
    expect(project.status).toBe(200);
    expect(project.data?.project).toMatchObject({ key: 'MKT' });

    const mcpProjects = await callTool(key.key, 'list_projects');
    expect(mcpProjects).toHaveLength(1);
    expect(mcpProjects[0]).toMatchObject({
      key: 'MKT',
      isFavorite: false,
      isHidden: true,
    });
    const mcpProject = await callTool(key.key, 'get_project', { projectKey: 'MKT' });
    expect(mcpProject.project).toMatchObject({ key: 'MKT' });
  });

  it("exposes preference updates over MCP and reports the caller's values", async () => {
    const { user, api } = await setup();
    const key = await auth.api.createApiKey({
      body: { userId: user.userId, name: 'project-preferences' },
    });

    const updated = await callTool(key.key, 'update_project_preferences', {
      projectKey: 'MKT',
      isFavorite: true,
      isHidden: true,
    });

    expect(updated).toMatchObject({ isFavorite: true, isHidden: true });
    expect((await api.projects.get()).data?.[0]).toMatchObject({
      key: 'MKT',
      isFavorite: true,
      isHidden: true,
    });
    const listed = await callTool(key.key, 'list_projects');
    expect(listed[0]).toMatchObject({ key: 'MKT', isFavorite: true, isHidden: true });
  });
});
