import { describe, expect, it, beforeEach } from 'bun:test';
import { api, scimApi } from '#tests/helpers/app';
import { writeSecret } from '@repo/db';
import { resetDb } from '#tests/helpers/db';
import { addUser } from '#modules/god/__tests__/helpers';
import { setupOtherWorkspace, setupScim } from '../helpers';

describe('SCIM discovery and authentication', () => {
  beforeEach(resetDb);

  describe('authentication', () => {
    it('refuses a request with no token', async () => {
      await setupScim();

      const res = await api.scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(401);
      expect(res.error!.value).toMatchObject({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
      });
    });

    it('refuses a wrong token', async () => {
      await setupScim();

      const res = await scimApi('scim_wrong').scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(401);
      expect(res.error!.value).toMatchObject({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
      });
    });

    it('refuses the right token while provisioning is off', async () => {
      const { settings, token } = await setupScim();
      await settings.patch({ enabled: false });

      const res = await scimApi(token).scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(401);
    });

    it('refuses a token that has been replaced', async () => {
      const { settings, token } = await setupScim();
      await settings.token.post();

      const res = await scimApi(token).scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(401);
    });
  });

  describe('workspace settings', () => {
    it('refuses an admin of the workspace', async () => {
      const { god, workspaceId } = await setupScim();
      const admin = await addUser({ email: 'someone@example.com' });
      await god.api.workspaces({ workspaceId }).managers.post({ userId: admin.id });
      const scim = admin.api.workspaces({ workspaceId }).scim;

      expect((await scim.get()).status).toBe(403);
      expect((await scim.token.post()).status).toBe(403);
    });

    it('refuses to enable provisioning before a token exists', async () => {
      const god = await addUser({ email: 'root@example.com' });
      const [workspace] = (await god.api.workspaces.get()).data!;

      const res = await god.api.workspaces({ workspaceId: workspace!.id }).scim.patch({
        enabled: true,
      });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ error: 'Generate a SCIM token first' });
    });

    it('reports the token prefix and the base URL, never the token', async () => {
      const { settings, token, workspaceId } = await setupScim();

      const res = await settings.get();

      expect(res.data).toMatchObject({
        enabled: true,
        hasToken: true,
        baseUrl: 'http://localhost:3000/scim/v2',
      });
      expect(token.startsWith(`scim_${workspaceId}_`)).toBe(true);
      expect(res.data!.tokenPrefix.length).toBeLessThan(token.length);
      expect(token.startsWith(res.data!.tokenPrefix)).toBe(true);
    });

    // A token generated before workspaces existed carries no workspace id, and the
    // identity providers already configured with one keep working.
    it('accepts a token without a workspace id for the instance workspace', async () => {
      const { workspaceId } = await setupScim();
      const legacy = 'scim_' + 'ab'.repeat(24);
      await writeSecret(`workspace.${workspaceId}.scim`, { enabled: true, token: legacy }, {});

      const res = await scimApi(legacy).scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(200);
    });

    it("refuses one workspace's token under another workspace's id", async () => {
      const { god, token } = await setupScim();
      const other = await setupOtherWorkspace(god);
      const forged = token.replace(/^scim_\d+_/, `scim_${other.workspaceId}_`);

      const res = await scimApi(forged).scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(401);
    });
  });

  describe('discovery documents', () => {
    it('describes what the server supports', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        patch: { supported: true },
        filter: { supported: true },
        bulk: { supported: false },
        sort: { supported: false },
        changePassword: { supported: false },
      });
    });

    it('lists the two resource types and serves each one', async () => {
      const { scim } = await setupScim();

      const list = await scim.scim.v2.ResourceTypes.get();
      expect(list.data).toMatchObject({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 2,
      });

      const one = await scim.scim.v2.ResourceTypes({ id: 'User' }).get();
      expect(one.data).toMatchObject({ id: 'User', endpoint: '/Users' });

      expect((await scim.scim.v2.ResourceTypes({ id: 'Nope' }).get()).status).toBe(404);
    });

    it('lists the two schemas and serves each one', async () => {
      const { scim } = await setupScim();

      const list = await scim.scim.v2.Schemas.get();
      expect(list.data).toMatchObject({ totalResults: 2 });

      const one = await scim.scim.v2
        .Schemas({ id: 'urn:ietf:params:scim:schemas:core:2.0:User' })
        .get();
      expect(one.data).toMatchObject({ name: 'User' });

      expect((await scim.scim.v2.Schemas({ id: 'urn:nope' }).get()).status).toBe(404);
    });
  });
});
