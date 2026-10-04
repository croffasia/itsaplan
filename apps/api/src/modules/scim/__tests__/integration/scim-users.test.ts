import { afterEach, describe, expect, it, beforeEach } from 'bun:test';
import { db, teamMember } from '@repo/db';
import { eq } from 'drizzle-orm';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { addUser, createAgentUser, joinProject, type Actor } from '#modules/god/__tests__/helpers';
import { setScimEmailPolicy } from '../../email-policy';
import { patchOps, scimUserBody, setupOtherWorkspace, setupScim } from '../helpers';

async function memberIdsOf(owner: Actor, projectKey: string) {
  const res = await owner.api.projects({ projectKey }).members.get();
  return res.data!.items.map((m) => m.userId);
}

async function teamsOf(actor: Actor) {
  return (await actor.api.teams.get()).data!;
}

describe('SCIM users', () => {
  beforeEach(resetDb);
  afterEach(() => setScimEmailPolicy());

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

    it('refuses an address the installed policy does not allow', async () => {
      const { scim } = await setupScim();
      setScimEmailPolicy(async (_workspaceId, email) => email.endsWith('@acme.test'));

      const refused = await scim.scim.v2.Users.post(scimUserBody({ userName: 'ada@example.com' }));
      const accepted = await scim.scim.v2.Users.post(scimUserBody({ userName: 'ada@acme.test' }));

      expect(refused.status).toBe(400);
      expect(refused.error?.value).toMatchObject({ scimType: 'invalidValue' });
      expect(accepted.status).toBe(201);
    });

    it('puts the provisioned account in no team, so it takes no seat', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Users.post(scimUserBody({ externalId: 'idp-1' }));

      expect(await db.$count(teamMember, eq(teamMember.userId, res.data!.id))).toBe(0);
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

    it('links an account that predates the sync, matching the address by case', async () => {
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
    it("writes the provider's id and keeps the name and address the account holds", async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody({ externalId: 'idp-1' }));

      const res = await scim.scim.v2.Users({ id: created.data!.id }).put(
        scimUserBody({
          userName: 'ada.byron@example.com',
          name: { givenName: 'Ada', familyName: 'Byron' },
          externalId: 'idp-2',
        }),
      );

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        userName: 'ada@example.com',
        displayName: 'Ada Lovelace',
        externalId: 'idp-2',
      });
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
    it('takes a deactivated person out of the workspace and leaves the account', async () => {
      const { god, scim } = await setupScim();
      const member = await addUser({ email: 'member@example.com' });
      await god.api.projects.post({ name: 'Marketing', key: 'MKT' });
      await joinProject(god, member, 'MKT', 'member');

      const res = await scim.scim.v2
        .Users({ id: member.id })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ active: false });
      expect(await memberIdsOf(god, 'MKT')).not.toContain(member.id);
      expect(await teamsOf(member)).toHaveLength(0);
      expect((await member.api.me.get()).data).toMatchObject({ authenticated: true });
      const signIn = await app.handle(
        new Request('http://localhost/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: member.email, password: 'test-password-123' }),
        }),
      );
      expect(signIn.status).toBe(200);
    });

    it('still lists a deactivated person, so the provider can turn them back on', async () => {
      const { scim } = await setupScim();
      const member = await addUser({ email: 'member@example.com' });
      await scim.scim.v2
        .Users({ id: member.id })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      const res = await scim.scim.v2.Users({ id: member.id }).get();

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ active: false });
    });

    it('passes a team and a project the person owned alone to the workspace owner', async () => {
      const { god, scim } = await setupScim();
      const member = await addUser({ email: 'member@example.com' });
      const [ownTeam] = await teamsOf(member);
      await member.api.projects.post({ name: 'Solo', key: 'SOL' });

      await scim.scim.v2
        .Users({ id: member.id })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      const godTeams = await teamsOf(god);
      expect(godTeams).toContainEqual(expect.objectContaining({ id: ownTeam!.id, role: 'owner' }));
      const members = (await god.api.projects({ projectKey: 'SOL' }).members.get()).data!.items;
      expect(members).toEqual([expect.objectContaining({ userId: god.id, role: 'owner' })]);
    });

    it('refuses to deactivate the workspace owner', async () => {
      const { god } = await setupScim();
      const owner = await addUser({ email: 'owner@example.com' });
      const [ownerTeam] = await teamsOf(owner);
      const other = await setupOtherWorkspace(owner, [ownerTeam!.id]);
      expect(god.id).not.toBe(owner.id);

      const res = await other.scim.scim.v2
        .Users({ id: owner.id })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({
        detail: 'The workspace owner cannot be deprovisioned through SCIM',
      });
      expect(await teamsOf(owner)).toHaveLength(1);
    });

    it('accepts the path-less replace some providers send', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2
        .Users({ id: created.data!.id })
        .patch(patchOps([{ op: 'replace', value: { active: false, displayName: 'Ada L.' } }]));

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ active: false, displayName: 'Ada Lovelace' });
    });

    it('accepts a name and an address and leaves the account its own', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2.Users({ id: created.data!.id }).patch(
        patchOps([
          { op: 'replace', path: 'name.familyName', value: 'Byron' },
          { op: 'replace', path: 'userName', value: 'ada.byron@example.com' },
          { op: 'replace', path: 'emails[type eq "work"].value', value: 'ada.byron@example.com' },
        ]),
      );

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        userName: 'ada@example.com',
        name: { givenName: 'Ada', familyName: 'Lovelace' },
      });
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
    it('takes the person out of the workspace and keeps the account', async () => {
      const { god, scim } = await setupScim();
      const member = await addUser({ email: 'member@example.com' });
      await god.api.projects.post({ name: 'Marketing', key: 'MKT' });
      await joinProject(god, member, 'MKT', 'member');
      await member.api.projects.post({ name: 'Solo', key: 'SOL' });

      const res = await scim.scim.v2.Users({ id: member.id }).delete();

      expect(res.status).toBe(204);
      expect((await scim.scim.v2.Users({ id: member.id }).get()).status).toBe(404);
      expect(await memberIdsOf(god, 'MKT')).not.toContain(member.id);
      expect(await memberIdsOf(god, 'SOL')).toEqual([god.id]);
      expect((await god.api.god.users({ userId: member.id }).get()).status).toBe(200);
    });

    it('refuses the instance owner', async () => {
      const { god, scim } = await setupScim();

      const res = await scim.scim.v2.Users({ id: god.id }).delete();

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({
        detail: 'An instance owner cannot be deleted through SCIM',
      });
    });

    it("does not see an AI agent's account", async () => {
      const { god, scim } = await setupScim();
      const project = await god.api.projects.post({ name: 'Agents', key: 'AGT' });
      const agentUserId = await createAgentUser(god, project.data!.key);

      const res = await scim.scim.v2.Users({ id: agentUserId }).delete();

      expect(res.status).toBe(404);
    });

    it('404s an unknown id', async () => {
      const { scim } = await setupScim();

      expect((await scim.scim.v2.Users({ id: 'nope' }).delete()).status).toBe(404);
    });
  });

  // A workspace's provider sees the accounts it wrote and the people in its teams.
  // Nothing else on the instance is visible to it, and what it writes stays its own.
  describe('workspaces', () => {
    it('sees nobody outside its own teams', async () => {
      const { god, scim } = await setupScim();
      const member = await addUser({ email: 'member@example.com' });
      const outsider = await addUser({ email: 'outsider@example.com' });
      const [outsiderTeam] = (await outsider.api.teams.get()).data!;
      await setupOtherWorkspace(god, [outsiderTeam!.id]);

      const list = await scim.scim.v2.Users.get({ query: {} });
      const ids = list.data!.Resources.map((u) => u.id);
      expect(ids).toContain(member.id);
      expect(ids).not.toContain(outsider.id);
      expect((await scim.scim.v2.Users({ id: outsider.id }).get()).status).toBe(404);
      const found = await scim.scim.v2.Users.get({
        query: { filter: 'userName eq "outsider@example.com"' },
      });
      expect(found.data).toMatchObject({ totalResults: 0 });
    });

    it('links the same person in two workspaces, each with its own id', async () => {
      const { god, scim } = await setupScim();
      const other = await setupOtherWorkspace(god);
      const ada = await scim.scim.v2.Users.post(scimUserBody({ externalId: 'first-1' }));
      expect((await other.scim.scim.v2.Users({ id: ada.data!.id }).get()).status).toBe(404);
      expect((await other.scim.scim.v2.Users({ id: ada.data!.id }).delete()).status).toBe(404);

      const linked = await other.scim.scim.v2.Users.post(scimUserBody({ externalId: 'other-1' }));

      expect(linked.status).toBe(201);
      expect(linked.data).toMatchObject({ id: ada.data!.id, externalId: 'other-1' });
      const first = await scim.scim.v2.Users({ id: ada.data!.id }).get();
      expect(first.data).toMatchObject({ externalId: 'first-1', active: true });
    });

    it('deactivates a person in its own workspace only', async () => {
      const { god, scim } = await setupScim();
      const owner = await addUser({ email: 'owner@example.com' });
      const person = await addUser({ email: 'person@example.com' });
      await god.api.projects.post({ name: 'Marketing', key: 'MKT' });
      await joinProject(god, person, 'MKT', 'member');
      const [ownerTeam] = await teamsOf(owner);
      await owner.api.projects.post({ name: 'Sales', key: 'SAL' });
      await joinProject(owner, person, 'SAL', 'member');
      const other = await setupOtherWorkspace(owner, [ownerTeam!.id]);

      const res = await other.scim.scim.v2
        .Users({ id: person.id })
        .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

      expect(res.status).toBe(200);
      expect(await memberIdsOf(owner, 'SAL')).not.toContain(person.id);
      expect(await memberIdsOf(god, 'MKT')).toContain(person.id);
      const first = await scim.scim.v2.Users({ id: person.id }).get();
      expect(first.data).toMatchObject({ active: true });
    });
  });
});
