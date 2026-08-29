import { describe, expect, it, beforeEach } from 'bun:test';
import { app, authedApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { addUser, createAgentUser } from '#modules/god/__tests__/helpers';
import { patchOps, scimUserBody, setupScim } from '../helpers';

describe('SCIM users', () => {
  beforeEach(resetDb);

  describe('POST /scim/v2/Users', () => {
    it('provisions an account and returns it as a SCIM user', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.post(scimUserBody({ externalId: 'idp-1' }));

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        externalId: 'idp-1',
        displayName: 'Ada Lovelace',
        name: { givenName: 'Ada', familyName: 'Lovelace', formatted: 'Ada Lovelace' },
        emails: [{ value: 'ada@example.com', primary: true }],
        active: true,
        meta: { resourceType: 'User' },
      });
      expect(res.data!.id).toBeTruthy();
    });

    it('accepts a user whose address only comes in the primary email', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        emails: [
          { value: 'other@example.com', primary: false },
          { value: 'grace@example.com', primary: true },
        ],
        displayName: 'Grace Hopper',
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ userName: 'grace@example.com' });
    });

    it('prefers the emails attribute over userName when both are present', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        // A directory that mixes a non-email login id into userName while still
        // reporting the real address in emails.
        userName: 'ada.lovelace',
        emails: [{ value: 'ada@example.com', primary: true }],
        displayName: 'Ada Lovelace',
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ userName: 'ada@example.com' });
    });

    it('accepts userName as a fallback address when it looks like one', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        displayName: 'Ada Lovelace',
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ userName: 'ada@example.com' });
    });

    it('refuses a userName that is not an email when emails is absent', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada.lovelace',
        displayName: 'Ada Lovelace',
      });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ scimType: 'invalidValue' });
    });

    it('refuses a body with no identifier', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        displayName: 'Nobody',
      });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ scimType: 'invalidValue' });
    });

    it('refuses to provision an address already linked to the provider', async () => {
      // A retry (Okta repeats a create after a timeout) must not silently
      // overwrite the id that links the account back to the provider.
      const { scim } = await setupScim();
      const first = await scim.scim.v2.Users.post(scimUserBody({ externalId: 'idp-1' }));

      const second = await scim.scim.v2.Users.post(
        scimUserBody({ externalId: 'idp-1-reprovisioned' }),
      );

      expect(second.status).toBe(409);
      expect(second.error!.value).toMatchObject({ scimType: 'uniqueness' });
      const unchanged = await scim.scim.v2.Users({ id: first.data!.id }).get();
      expect(unchanged.data!.externalId).toBe('idp-1');
    });

    it('claims an account that predates the sync, matching the address by case', async () => {
      const { scim } = await setupScim();
      const existing = await signUpTestUser({ email: 'Ada.Lovelace@Example.com' });

      const res = await scim.scim.v2.Users.post(
        scimUserBody({ userName: 'ada.lovelace@example.com' }),
      );

      expect(res.status).toBe(201);
      expect(res.data!.id).toBe(existing.userId);
      const list = await scim.scim.v2.Users.get({ query: {} });
      expect(list.data!.Resources.filter((u) => u.id === existing.userId)).toHaveLength(1);
    });

    it("refuses to claim the instance owner's account", async () => {
      const { god, scim } = await setupScim();

      const res = await scim.scim.v2.Users.post(scimUserBody({ userName: god.email }));

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({
        detail: 'An instance owner cannot be provisioned through SCIM',
      });
    });

    // RFC 7644 §3.1 lets a SCIM client send this content type instead of
    // application/json, and real identity providers (Okta, Entra, Authentik) do.
    // Eden Treaty always sends application/json, so this goes through app.handle
    // directly with the header set by hand.
    it('accepts a body sent as application/scim+json', async () => {
      const { token } = await setupScim();

      const res = await app.handle(
        new Request('http://localhost/scim/v2/Users', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/scim+json',
          },
          body: JSON.stringify(scimUserBody()),
        }),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as { userName: string };
      expect(body.userName).toBe('ada@example.com');
    });

    it('provisions on a closed instance, where signing up is refused', async () => {
      const { god, scim } = await setupScim();
      await god.api.god['auth-settings'].put({ registration: 'closed' });

      const res = await scim.scim.v2.Users.post(scimUserBody());

      expect(res.status).toBe(201);
    });
  });

  describe('GET /scim/v2/Users', () => {
    it('pages the accounts and reports the total', async () => {
      const { scim } = await setupScim();
      await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2.Users.get({ query: { startIndex: 1, count: 10 } });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        // The instance owner registered in setupScim counts too.
        totalResults: 2,
        startIndex: 1,
        itemsPerPage: 2,
      });
    });

    it('finds one account by userName', async () => {
      const { scim } = await setupScim();
      await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2.Users.get({
        query: { filter: 'userName eq "ada@example.com"' },
      });

      expect(res.data).toMatchObject({ totalResults: 1 });
      expect(res.data!.Resources[0]).toMatchObject({ userName: 'ada@example.com' });
    });

    it('finds one account by externalId', async () => {
      const { scim } = await setupScim();
      await scim.scim.v2.Users.post(scimUserBody({ externalId: 'idp-7' }));

      const res = await scim.scim.v2.Users.get({ query: { filter: 'externalId eq "idp-7"' } });

      expect(res.data).toMatchObject({ totalResults: 1 });
    });

    it('answers an empty list for an address that has no account', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.get({ query: { filter: 'userName eq "nobody@x.io"' } });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ totalResults: 0, Resources: [] });
    });

    it('refuses a filter it does not implement', async () => {
      const { scim } = await setupScim();

      const unsupportedOperator = await scim.scim.v2.Users.get({
        query: { filter: 'userName co "ada"' },
      });
      expect(unsupportedOperator.status).toBe(400);
      expect(unsupportedOperator.error!.value).toMatchObject({ scimType: 'invalidFilter' });

      const unsupportedAttribute = await scim.scim.v2.Users.get({
        query: { filter: 'nickName eq "ada"' },
      });
      expect(unsupportedAttribute.status).toBe(400);
      expect(unsupportedAttribute.error!.value).toMatchObject({ scimType: 'invalidFilter' });
    });
  });

  describe("AI agents' accounts", () => {
    // An agent's bot user belongs to the project that created it, not to the identity
    // provider. Letting a sync reach it would let it rename the agent or deactivate
    // it, which stops the agent without a trace.
    it('leaves them out of the list, and 404s every route that names one', async () => {
      const { god, scim } = await setupScim();
      const project = await god.api.projects.post({ name: 'Agents', key: 'AGT' });
      const agentUserId = await createAgentUser(god, project.data!.key);

      const list = await scim.scim.v2.Users.get({ query: {} });
      expect(list.data!.Resources.map((u) => u.id)).not.toContain(agentUserId);

      expect((await scim.scim.v2.Users({ id: agentUserId }).get()).status).toBe(404);
      expect((await scim.scim.v2.Users({ id: agentUserId }).put(scimUserBody())).status).toBe(404);
      expect(
        (
          await scim.scim.v2
            .Users({ id: agentUserId })
            .patch(patchOps([{ op: 'replace', path: 'active', value: false }]))
        ).status,
      ).toBe(404);
    });
  });

  describe('GET /scim/v2/Users/:id', () => {
    it('serves one account and 404s an unknown id', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2.Users({ id: created.data!.id }).get();
      expect(res.data).toMatchObject({ userName: 'ada@example.com' });

      expect((await scim.scim.v2.Users({ id: 'nope' }).get()).status).toBe(404);
    });
  });

  describe('PUT /scim/v2/Users/:id', () => {
    it('replaces the account', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody({ externalId: 'idp-1' }));

      const res = await scim.scim.v2.Users({ id: created.data!.id }).put(
        scimUserBody({
          userName: 'ada.byron@example.com',
          name: { givenName: 'Ada', familyName: 'Byron' },
          externalId: 'idp-1',
        }),
      );

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        userName: 'ada.byron@example.com',
        displayName: 'Ada Byron',
      });
    });

    it('refuses an address another account already has', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());
      await scim.scim.v2.Users.post(scimUserBody({ userName: 'grace@example.com' }));

      const res = await scim.scim.v2
        .Users({ id: created.data!.id })
        .put(scimUserBody({ userName: 'grace@example.com' }));

      expect(res.status).toBe(409);
    });

    it('refuses the instance owner', async () => {
      const { god, scim } = await setupScim();

      const res = await scim.scim.v2.Users({ id: god.id }).put(scimUserBody());

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({
        detail: 'An instance owner cannot be updated through SCIM',
      });
    });
  });

  describe('PATCH /scim/v2/Users/:id', () => {
    it('deactivates an account and cuts off its open session', async () => {
      const { scim } = await setupScim();
      const member = await signUpTestUser({ email: 'member@example.com' });
      const session = authedApi(member.cookie);
      expect((await session.projects.get()).status).toBe(200);

      const res = await scim.scim.v2
        .Users({ id: member.userId })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ active: false });
      expect((await session.projects.get()).status).toBe(401);
      expect((await session.me.get()).data).toMatchObject({ authenticated: false });
    });

    it('lets a reactivated account back in', async () => {
      const { scim } = await setupScim();
      const member = await signUpTestUser({ email: 'member@example.com' });
      const session = authedApi(member.cookie);
      await scim.scim.v2
        .Users({ id: member.userId })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      await scim.scim.v2
        .Users({ id: member.userId })
        .patch(patchOps([{ op: 'replace', path: 'active', value: true }]));

      expect((await session.projects.get()).status).toBe(200);
      expect((await session.me.get()).data).toMatchObject({ authenticated: true });
    });

    it('refuses a deactivated account a new sign-in', async () => {
      const { scim } = await setupScim();
      const member = await signUpTestUser({ email: 'member@example.com' });
      await scim.scim.v2
        .Users({ id: member.userId })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      const res = await app.handle(
        new Request('http://localhost/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: member.email, password: 'test-password-123' }),
        }),
      );

      expect(res.status).toBe(403);
    });

    it('accepts the path-less replace some providers send', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2
        .Users({ id: created.data!.id })
        .patch(patchOps([{ op: 'replace', value: { active: false, displayName: 'Ada L.' } }]));

      expect(res.data).toMatchObject({ active: false, displayName: 'Ada L.' });
    });

    it('updates one part of the name and keeps the other', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2
        .Users({ id: created.data!.id })
        .patch(patchOps([{ op: 'replace', path: 'name.familyName', value: 'Byron' }]));

      expect(res.data).toMatchObject({ name: { givenName: 'Ada', familyName: 'Byron' } });
    });

    it('refuses an attribute it cannot write', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2
        .Users({ id: created.data!.id })
        .patch(patchOps([{ op: 'replace', path: 'title', value: 'Countess' }]));

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ scimType: 'invalidPath' });
    });

    it('refuses a body that is not a PatchOp', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2
        .Users({ id: created.data!.id })
        .patch({ Operations: [{ op: 'replace', path: 'active', value: false }] });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ scimType: 'invalidSyntax' });
    });

    it('refuses to deactivate the instance owner', async () => {
      const { god, scim } = await setupScim();

      const res = await scim.scim.v2
        .Users({ id: god.id })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({
        detail: 'An instance owner cannot be updated through SCIM',
      });
    });
  });

  describe('DELETE /scim/v2/Users/:id', () => {
    it('removes the account', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2.Users({ id: created.data!.id }).delete();

      expect(res.status).toBe(204);
      expect((await scim.scim.v2.Users({ id: created.data!.id }).get()).status).toBe(404);
    });

    it('refuses the instance owner', async () => {
      const { god, scim } = await setupScim();

      const res = await scim.scim.v2.Users({ id: god.id }).delete();

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({ detail: 'An instance owner cannot be deleted' });
    });

    it("does not see an AI agent's account", async () => {
      const { god, scim } = await setupScim();
      const project = await god.api.projects.post({ name: 'Agents', key: 'AGT' });
      const agentUserId = await createAgentUser(god, project.data!.key);

      const res = await scim.scim.v2.Users({ id: agentUserId }).delete();

      expect(res.status).toBe(404);
    });

    it('refuses the only owner of a project', async () => {
      const { god, scim } = await setupScim();
      const owner = await addUser({ email: 'owner@example.com' });
      await owner.api.projects.post({ name: 'Solo', key: 'SOL' });
      expect(god.id).not.toBe(owner.id);

      const res = await scim.scim.v2.Users({ id: owner.id }).delete();

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({
        detail: expect.stringContaining('only owner of a project'),
      });
    });

    it('404s an unknown id', async () => {
      const { scim } = await setupScim();

      expect((await scim.scim.v2.Users({ id: 'nope' }).delete()).status).toBe(404);
    });
  });
});
