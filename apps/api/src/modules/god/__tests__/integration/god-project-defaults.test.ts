import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The instance-wide project defaults under god mode: what a project starts with
// when it is created. Only the instance owner may read or change them, and a
// change reaches new projects only — the ones that already exist keep whatever
// they were set to.

describe('god project defaults', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('access', () => {
    it('refuses both routes for a user who is not the instance owner', async () => {
      await setup();
      const outsider = await addUser();

      expect((await outsider.api.god['project-defaults'].get()).status).toBe(403);
      expect((await outsider.api.god['project-defaults'].put({ mcpEnabled: false })).status).toBe(
        403,
      );
    });
  });

  describe('settings — GET/PUT /god/project-defaults', () => {
    it('starts with MCP on, so an instance driven through MCP needs no toggle', async () => {
      const { god } = await setup();

      const res = await god.api.god['project-defaults'].get();

      expect(res.status).toBe(200);
      expect(res.data?.mcpEnabled).toBe(true);
    });

    it('stores a change and reads it back', async () => {
      const { god } = await setup();

      const put = await god.api.god['project-defaults'].put({ mcpEnabled: false });
      const get = await god.api.god['project-defaults'].get();

      expect(put.status).toBe(200);
      expect(put.data?.mcpEnabled).toBe(false);
      expect(get.data?.mcpEnabled).toBe(false);
    });
  });

  describe('effect on project creation', () => {
    it('creates a project with MCP on under the default', async () => {
      const { god } = await setup();

      const created = await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const settings = await god.api.projects({ projectKey: 'MKT' }).settings.get();

      expect(created.status).toBe(201);
      expect(settings.data?.mcpEnabled).toBe(true);
    });

    it('creates a project with MCP off once the default is turned off', async () => {
      const { god } = await setup();
      await god.api.god['project-defaults'].put({ mcpEnabled: false });

      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const settings = await god.api.projects({ projectKey: 'MKT' }).settings.get();

      expect(settings.data?.mcpEnabled).toBe(false);
    });

    it('leaves projects that already exist untouched', async () => {
      const { god } = await setup();
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const before = await god.api.projects({ projectKey: 'MKT' }).settings.get();
      expect(before.data?.mcpEnabled).toBe(true);

      await god.api.god['project-defaults'].put({ mcpEnabled: false });

      const after = await god.api.projects({ projectKey: 'MKT' }).settings.get();
      expect(after.data?.mcpEnabled).toBe(true);
    });

    it('applies the default to a project created by any member, not just the owner', async () => {
      const { god } = await setup();
      await god.api.god['project-defaults'].put({ mcpEnabled: false });
      const alice = await addUser();

      await alice.api.projects.post({ key: 'ALC', name: 'Alice Only' });
      const settings = await alice.api.projects({ projectKey: 'ALC' }).settings.get();

      expect(settings.data?.mcpEnabled).toBe(false);
    });
  });
});
