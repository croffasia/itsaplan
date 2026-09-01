import { describe, expect, it, beforeEach } from 'bun:test';
import { api, scimApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { addUser } from '#modules/god/__tests__/helpers';
import { setupScim } from '../helpers';

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
      const { god, token } = await setupScim();
      await god.api.god['scim-settings'].put({ enabled: false });

      const res = await scimApi(token).scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(401);
    });

    it('refuses a token that has been replaced', async () => {
      const { god, token } = await setupScim();
      await god.api.god['scim-settings'].token.post();

      const res = await scimApi(token).scim.v2.ServiceProviderConfig.get();

      expect(res.status).toBe(401);
    });
  });

  describe('god settings', () => {
    it('refuses a plain user', async () => {
      await addUser({ email: 'root@example.com' });
      const user = await addUser({ email: 'someone@example.com' });

      expect((await user.api.god['scim-settings'].get()).status).toBe(403);
      expect((await user.api.god['scim-settings'].token.post()).status).toBe(403);
    });

    it('refuses to enable provisioning before a token exists', async () => {
      const god = await addUser({ email: 'root@example.com' });

      const res = await god.api.god['scim-settings'].put({ enabled: true });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ error: 'Generate a SCIM token first' });
    });

    it('reports the token prefix and the base URL, never the token', async () => {
      const { god, token } = await setupScim();

      const res = await god.api.god['scim-settings'].get();

      expect(res.data).toMatchObject({
        enabled: true,
        hasToken: true,
        baseUrl: 'http://localhost:7002/scim/v2',
      });
      expect(res.data!.tokenPrefix.length).toBeLessThan(token.length);
      expect(token.startsWith(res.data!.tokenPrefix)).toBe(true);
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
