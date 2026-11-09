import { describe, it, expect, beforeEach } from 'bun:test';
import { createProject } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// System roles under god mode: permission matrices that belong to no team. Only the
// instance owner writes them; every team assigns them and edits none.

describe('god system roles', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses every route to a user who is not the instance owner', async () => {
    const { god } = await setup();
    const outsider = await addUser();
    const created = await god.api.god.roles.post({ name: 'Viewer', permissions: {} });
    const roles = outsider.api.god.roles;

    expect((await roles.get()).status).toBe(403);
    expect((await roles.post({ name: 'Editor', permissions: {} })).status).toBe(403);
    expect((await roles({ roleId: created.data!.id }).patch({ name: 'X' })).status).toBe(403);
    expect((await roles({ roleId: created.data!.id }).delete()).status).toBe(403);
  });

  it('creates, updates, lists and deletes a system role', async () => {
    const { god } = await setup();

    const created = await god.api.god.roles.post({
      name: 'Viewer',
      permissions: { work_items: { read: true, bogus: true } },
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ system: true, isDefault: false });
    expect(created.data?.permissions.work_items).toEqual({
      create: false,
      edit: false,
      read: true,
      delete: false,
    });

    const id = created.data!.id;
    const updated = await god.api.god.roles({ roleId: id }).patch({
      name: 'Reader',
      permissions: { documents: { read: true } },
    });
    expect(updated.data?.name).toBe('Reader');
    expect(updated.data?.permissions.documents.read).toBe(true);
    expect(updated.data?.permissions.work_items.read).toBe(false);

    const names = async () => (await god.api.god.roles.get()).data?.map((r) => r.name);
    expect(await names()).toEqual(['Member', 'Reader']);

    expect((await god.api.god.roles({ roleId: id }).delete()).status).toBe(204);
    expect(await names()).toEqual(['Member']);
  });

  it('refuses a second system role with the same name', async () => {
    const { god } = await setup();
    await god.api.god.roles.post({ name: 'Viewer', permissions: {} });

    expect((await god.api.god.roles.post({ name: 'Viewer', permissions: {} })).status).toBe(409);
  });

  it('offers system roles to every team, which cannot edit them', async () => {
    const { god } = await setup();
    await createProject(god.api, { key: 'MKT', name: 'Marketing' });
    const teamId = (await god.api.teams.get()).data![0].id;
    const own = (await god.api.teams({ teamId }).roles.post({ name: 'Editor', permissions: {} }))
      .data!;
    const system = (await god.api.god.roles.post({ name: 'Viewer', permissions: {} })).data!;

    const offered = (await god.api.teams({ teamId }).roles.options.get()).data!;
    expect(offered.map((r) => [r.name, r.system])).toEqual([
      ['Member', true],
      ['Viewer', true],
      ['Editor', false],
    ]);
    const team = god.api.teams({ teamId }).roles({ roleId: system.id });
    expect((await team.patch({ name: 'X' })).status).toBe(404);
    expect((await team.delete()).status).toBe(404);
    expect((await god.api.god.roles({ roleId: own.id }).patch({ name: 'X' })).status).toBe(404);
    expect((await god.api.god.roles({ roleId: own.id }).delete()).status).toBe(404);
  });

  it('keeps the default system role: editable, never deleted', async () => {
    const { god } = await setup();
    const member = (await god.api.god.roles.get()).data!.find((r) => r.isDefault)!;

    const updated = await god.api.god.roles({ roleId: member.id }).patch({
      permissions: { documents: { read: true } },
    });
    expect(updated.data?.permissions.documents.read).toBe(true);
    expect((await god.api.god.roles({ roleId: member.id }).delete()).status).toBe(400);
  });

  it('refuses to delete a system role a pending invite is on', async () => {
    const { god } = await setup();
    await createProject(god.api, { key: 'MKT', name: 'Marketing' });
    const system = (await god.api.god.roles.post({ name: 'Viewer', permissions: {} })).data!;
    await god.api
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: 'guest@example.com', role: 'member', roleId: system.id });

    expect((await god.api.god.roles({ roleId: system.id }).delete()).status).toBe(409);
  });
});
