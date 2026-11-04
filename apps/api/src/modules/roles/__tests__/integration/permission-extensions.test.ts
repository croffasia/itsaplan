import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole, listProjectRoles } from '#tests/helpers/roles';
import { setPermissionExtensions } from '#shared/permissions';

type Matrix = Record<string, Record<string, boolean>>;

describe('permission extensions', () => {
  let owner: Api;

  beforeEach(async () => {
    await resetDb();
    owner = authedApi((await signUpTestUser()).cookie);
    await createProject(owner, { key: 'MKT', name: 'Marketing' });
  });

  afterEach(() => setPermissionExtensions());

  it('lists the resource in the catalog with the one it comes from', async () => {
    setPermissionExtensions([{ resource: 'agent_extra', from: 'ai_agents' }]);
    const { data } = await owner['permission-catalog'].get();
    expect(data!.resources.find((one) => one.key === 'agent_extra')).toMatchObject({
      from: 'ai_agents',
      actions: ['create', 'edit', 'read', 'delete'],
    });
  });

  it('reads a role saved before the resource as the one it comes from', async () => {
    const created = await createRole(owner, 'MKT', {
      name: 'Agents',
      permissions: { ai_agents: { read: true } },
    });
    setPermissionExtensions([{ resource: 'agent_extra', from: 'ai_agents' }]);
    const roles = await listProjectRoles(owner, 'MKT');
    const role = roles.data!.find((one) => one.id === created.data!.id)!;
    expect((role.permissions as Matrix).agent_extra.read).toBe(true);
  });

  it('keeps what a role saves of the resource', async () => {
    setPermissionExtensions([{ resource: 'agent_extra', from: 'ai_agents' }]);
    const created = await createRole(owner, 'MKT', {
      name: 'Extra',
      permissions: { agent_extra: { edit: true } },
    });
    const permissions = created.data!.permissions as Matrix;
    expect(permissions.agent_extra.edit).toBe(true);
    expect(permissions.ai_agents.edit).toBe(false);
  });
});
