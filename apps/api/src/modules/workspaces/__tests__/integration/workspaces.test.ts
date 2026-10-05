import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { setAuthSettings, setWorkspaceScim } from '@repo/auth';
import { db, workspace } from '@repo/db';
import { deleteAccount } from '#shared/account-deletion';
import { setOwnedWorkspaceLimit } from '#shared/limits';
import { apiKeyApi, app, authedApi } from '#tests/helpers/app';
import { createAgent } from '#tests/helpers/agents';
import { signUpTestUser, type TestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createOwnWorkspace, transferWorkspace } from '../../service';

// The first account is the owner of the instance workspace; every account signed up
// with a team is a person in it.
async function setup() {
  const owner = await signUpTestUser();
  const ownerApi = authedApi(owner.cookie);
  const [workspace] = (await ownerApi.workspaces.get()).data!;
  return { owner, ownerApi, workspaceId: workspace!.id };
}

async function makeAdmin(
  ownerApi: ReturnType<typeof authedApi>,
  workspaceId: number,
  person: TestUser,
) {
  const res = await ownerApi.workspaces({ workspaceId }).managers.post({ userId: person.userId });
  expect(res.status).toBe(201);
}

describe('workspaces', () => {
  beforeEach(resetDb);

  describe('GET /workspaces', () => {
    it('lists the workspace with the standing of each reader', async () => {
      const { ownerApi, workspaceId } = await setup();
      await setAuthSettings({ personalWorkspaces: false });
      const member = await signUpTestUser();
      const outsider = await signUpTestUser({ team: false });

      expect((await ownerApi.workspaces.get()).data).toEqual([
        { id: workspaceId, name: 'Workspace', role: 'owner', color: null, canCreateTeam: true },
      ]);
      expect((await authedApi(member.cookie).workspaces.get()).data).toEqual([
        { id: workspaceId, name: 'Workspace', role: null, color: null, canCreateTeam: false },
      ]);
      expect((await authedApi(outsider.cookie).workspaces.get()).data).toEqual([]);
    });
  });

  describe('GET /workspaces/:workspaceId', () => {
    it('answers a manager with the counts', async () => {
      const { ownerApi, workspaceId } = await setup();
      await signUpTestUser();

      const res = await ownerApi.workspaces({ workspaceId }).get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ role: 'owner', managerCount: 1 });
    });

    it('answers 404 to somebody who does not manage it', async () => {
      const { workspaceId } = await setup();
      const member = await signUpTestUser();

      expect((await authedApi(member.cookie).workspaces({ workspaceId }).get()).status).toBe(404);
    });
  });

  describe('PATCH /workspaces/:workspaceId', () => {
    it('renames it for an admin', async () => {
      const { ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);

      const res = await authedApi(admin.cookie).workspaces({ workspaceId }).patch({ name: 'Acme' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'Acme', role: 'admin' });
    });

    it('refuses an empty name and one past 60 characters', async () => {
      const { ownerApi, workspaceId } = await setup();

      expect((await ownerApi.workspaces({ workspaceId }).patch({ name: '' })).status).toBe(400);
      expect(
        (await ownerApi.workspaces({ workspaceId }).patch({ name: 'a'.repeat(61) })).status,
      ).toBe(400);
      expect(
        (await ownerApi.workspaces({ workspaceId }).patch({ name: 'a'.repeat(60) })).status,
      ).toBe(200);
    });
  });

  describe('settings', () => {
    it('lets a manager recolour it, and refuses a colour that is not #rrggbb', async () => {
      const { ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);
      const ws = authedApi(admin.cookie).workspaces({ workspaceId });

      expect((await ws.patch({ color: '#3b82f6' })).data).toMatchObject({ color: '#3b82f6' });
      expect((await ws.patch({ color: 'blue' })).status).toBe(400);
      expect((await ws.patch({ color: null })).data).toMatchObject({ color: null });
    });

    it('leaves who creates teams to the owner, and applies it to POST /teams', async () => {
      const { ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      const member = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);
      const adminApi = authedApi(admin.cookie);
      const memberApi = authedApi(member.cookie);
      const team = (api: typeof adminApi, slug: string) =>
        api.teams.post({ name: slug, slug, workspaceId });
      const memberMay = async () =>
        (await memberApi.workspaces.get()).data!.find((w) => w.id === workspaceId)!.canCreateTeam;

      expect((await team(adminApi, 'by-admin')).status).toBe(403);
      expect(
        (await adminApi.workspaces({ workspaceId }).patch({ teamCreation: 'members' })).status,
      ).toBe(403);

      await ownerApi.workspaces({ workspaceId }).patch({ teamCreation: 'managers' });
      expect((await team(adminApi, 'by-admin')).status).toBe(201);
      expect((await team(memberApi, 'by-member')).status).toBe(403);
      expect(await memberMay()).toBe(false);

      await ownerApi.workspaces({ workspaceId }).patch({ teamCreation: 'members' });
      expect(await memberMay()).toBe(true);
      expect((await team(memberApi, 'by-member')).status).toBe(201);
    });
  });

  describe('transferWorkspace', () => {
    async function joinTeam(api: ReturnType<typeof authedApi>, teamId: number, person: TestUser) {
      const invite = await api
        .teams({ teamId })
        .invites.post({ email: person.email, role: 'member' });
      await authedApi(person.cookie).invites({ token: invite.data!.token }).accept.post();
    }

    // A person's own workspace with a team, and an admin of it who owns no workspace.
    async function withAdmin() {
      await setup();
      const person = await signUpTestUser({ team: false });
      const personApi = authedApi(person.cookie);
      const [own] = (await personApi.workspaces.get()).data!;
      const workspaceId = own!.id;
      const teamId = (await personApi.teams.post({ name: 'Solo', slug: 'solo', workspaceId })).data!
        .id;
      // Off from here on: on, every request would make the admin a workspace of their own.
      await setAuthSettings({ personalWorkspaces: false });
      const admin = await signUpTestUser({ team: false });
      await joinTeam(personApi, teamId, admin);
      await personApi.workspaces({ workspaceId }).managers.post({ userId: admin.userId });
      return { person, personApi, admin, workspaceId, teamId };
    }

    it('hands it to an admin, and the owner stays on as an admin', async () => {
      const { person, personApi, admin, workspaceId } = await withAdmin();

      await transferWorkspace(workspaceId, person.userId, admin.userId);

      const managers = (await personApi.workspaces({ workspaceId }).managers.get()).data!;
      expect(managers.map((m) => [m.userId, m.role])).toEqual([
        [admin.userId, 'owner'],
        [person.userId, 'admin'],
      ]);
    });

    it('refuses somebody who is not its admin, or who owns a workspace already', async () => {
      const { person, personApi, workspaceId, teamId } = await withAdmin();
      await setAuthSettings({ personalWorkspaces: true });
      const other = await signUpTestUser({ team: false });
      const transfer = () => transferWorkspace(workspaceId, person.userId, other.userId);

      await expect(transfer()).rejects.toThrow('This person is not an admin of the workspace');
      await joinTeam(personApi, teamId, other);
      await personApi.workspaces({ workspaceId }).managers.post({ userId: other.userId });
      await expect(transfer()).rejects.toThrow('already owns as many workspaces');
    });

    it('keeps the instance workspace with the instance owner', async () => {
      const { owner, ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);

      await expect(transferWorkspace(workspaceId, owner.userId, admin.userId)).rejects.toThrow(
        'The instance workspace stays with the instance owner',
      );
    });
  });

  describe('managers', () => {
    it('lists the owner first, then the admins', async () => {
      const { owner, ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);

      const res = await ownerApi.workspaces({ workspaceId }).managers.get();
      expect(res.data!.map((m) => [m.userId, m.role])).toEqual([
        [owner.userId, 'owner'],
        [admin.userId, 'admin'],
      ]);
    });

    it('offers the people of its teams who do not manage it yet', async () => {
      const { ownerApi, workspaceId } = await setup();
      const member = await signUpTestUser({ name: 'Grace Hopper' });
      await signUpTestUser({ name: 'Ada Lovelace', team: false });

      const all = await ownerApi.workspaces({ workspaceId }).managers.candidates.get();
      expect(all.data!.map((c) => c.userId)).toEqual([member.userId]);
      const none = await ownerApi
        .workspaces({ workspaceId })
        .managers.candidates.get({ query: { search: 'ada' } });
      expect(none.data).toEqual([]);
    });

    it('refuses somebody outside its teams and somebody already managing it', async () => {
      const { owner, ownerApi, workspaceId } = await setup();
      const outsider = await signUpTestUser({ team: false });
      const managers = ownerApi.workspaces({ workspaceId }).managers;

      expect((await managers.post({ userId: outsider.userId })).status).toBe(404);
      expect((await managers.post({ userId: owner.userId })).status).toBe(409);
    });

    it('lets only the owner appoint and remove admins', async () => {
      const { ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      const other = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);
      const adminManagers = authedApi(admin.cookie).workspaces({ workspaceId }).managers;

      expect((await adminManagers.post({ userId: other.userId })).status).toBe(403);
      expect((await adminManagers({ userId: admin.userId }).delete()).status).toBe(403);
    });

    it('removes an admin but never the owner', async () => {
      const { owner, ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);
      const managers = ownerApi.workspaces({ workspaceId }).managers;

      expect((await managers({ userId: admin.userId }).delete()).status).toBe(204);
      expect((await managers({ userId: admin.userId }).delete()).status).toBe(404);
      expect((await managers({ userId: owner.userId }).delete()).status).toBe(409);
      expect((await authedApi(admin.cookie).workspaces({ workspaceId }).get()).status).toBe(404);
    });
  });

  describe('personal workspaces', () => {
    afterEach(() => setWorkspaceScim(false));

    it('gives every account after the first one a workspace only it sees', async () => {
      const { ownerApi, workspaceId } = await setup();
      const person = await signUpTestUser({ name: 'Jane Doe', team: false });

      const [own] = (await authedApi(person.cookie).workspaces.get()).data!;
      expect(own).toMatchObject({ name: 'Jane Doe', role: 'owner' });
      expect(own!.id).not.toBe(workspaceId);
      expect((await ownerApi.workspaces.get()).data).toEqual([
        { id: workspaceId, name: 'Workspace', role: 'owner', color: null, canCreateTeam: true },
      ]);
    });

    it('leaves SCIM provisioning to the instance owner', async () => {
      await setup();
      const person = authedApi((await signUpTestUser({ team: false })).cookie);
      const [own] = (await person.workspaces.get()).data!;
      const scim = person.workspaces({ workspaceId: own!.id }).scim;

      expect((await scim.get()).status).toBe(403);
      expect((await scim.token.post()).status).toBe(403);

      setWorkspaceScim();
      expect((await scim.get()).status).toBe(200);
    });

    it('turns off on its own, leaving the registration mode as it is', async () => {
      const { ownerApi } = await setup();
      const settings = ownerApi.god['auth-settings'];
      await settings.put({ registration: 'invite' });

      await settings.put({ personalWorkspaces: false });

      expect((await settings.get()).data).toMatchObject({
        registration: 'invite',
        personalWorkspaces: false,
      });
    });

    it('gives none while they are off', async () => {
      await setup();
      await setAuthSettings({ personalWorkspaces: false });
      const person = await signUpTestUser({ team: false });

      expect((await authedApi(person.cookie).workspaces.get()).data).toEqual([]);
    });

    it('makes one on the next request for an account made while they were off', async () => {
      await setup();
      await setAuthSettings({ personalWorkspaces: false });
      const person = authedApi((await signUpTestUser({ name: 'Jane Doe', team: false })).cookie);
      expect((await person.workspaces.get()).data).toEqual([]);

      await setAuthSettings({ personalWorkspaces: true });

      expect((await person.workspaces.get()).data).toEqual([
        expect.objectContaining({ name: 'Jane Doe', role: 'owner' }),
      ]);
    });

    it('makes none for an AI agent, and no route creates one', async () => {
      const { owner, ownerApi } = await setup();
      await ownerApi.projects.post({ key: 'MKT', name: 'Marketing' });
      const created = await createAgent(ownerApi, 'MKT', {
        name: 'Bot',
        username: 'bot',
        kind: 'external',
      });
      const bot = apiKeyApi(created.data!.apiKey!);

      const seen = (await bot.workspaces.get()).data!;
      expect(seen.filter((w) => w.role === 'owner')).toEqual([]);
      const post = await app.handle(
        new Request('http://localhost/workspaces', {
          method: 'POST',
          headers: { cookie: owner.cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Second' }),
        }),
      );
      expect(post.status).toBe(404);
    });

    it('goes with a deleted account while it holds no project', async () => {
      await setup();
      const person = await signUpTestUser({ team: false });
      const personApi = authedApi(person.cookie);
      const [own] = (await personApi.workspaces.get()).data!;
      await personApi.teams.post({ name: 'Solo', slug: 'solo', workspaceId: own!.id });

      await deleteAccount(person.userId);

      expect(await db.select().from(workspace).where(eq(workspace.id, own!.id))).toEqual([]);
    });

    it('passes to the instance owner, with what the deleted account owned alone', async () => {
      const { owner, ownerApi } = await setup();
      const person = await signUpTestUser({ team: false });
      const personApi = authedApi(person.cookie);
      const [own] = (await personApi.workspaces.get()).data!;
      const team = await personApi.teams.post({ name: 'Solo', slug: 'solo', workspaceId: own!.id });
      await personApi.teams({ teamId: team.data!.id }).projects.post({ name: 'Solo', key: 'SOL' });

      await deleteAccount(person.userId);

      expect((await ownerApi.workspaces({ workspaceId: own!.id }).get()).data).toMatchObject({
        role: 'owner',
      });
      const members = (await ownerApi.projects({ projectKey: 'SOL' }).members.get()).data!.items;
      expect(members).toEqual([expect.objectContaining({ userId: owner.userId, role: 'owner' })]);
    });
  });

  describe('DELETE /workspaces/:workspaceId', () => {
    async function ownWorkspace() {
      await setup();
      const person = await signUpTestUser({ team: false });
      const personApi = authedApi(person.cookie);
      const [own] = (await personApi.workspaces.get()).data!;
      const team = await personApi.teams.post({ name: 'Solo', slug: 'solo', workspaceId: own!.id });
      return { person, personApi, workspaceId: own!.id, teamId: team.data!.id };
    }

    it('lets the owner delete one without work, with its teams', async () => {
      const { personApi, workspaceId } = await ownWorkspace();
      const ws = personApi.workspaces({ workspaceId });

      expect((await ws.get()).data).toMatchObject({ deletion: 'allowed' });
      expect((await ws.delete()).status).toBe(204);
      expect((await personApi.teams.get()).data).toEqual([]);
      // Personal workspaces are on, so the next request makes the owner a fresh one.
      const [fresh] = (await personApi.workspaces.get()).data!;
      expect(fresh).toMatchObject({ role: 'owner' });
      expect(fresh!.id).not.toBe(workspaceId);
    });

    it('keeps one whose teams hold a project', async () => {
      const { personApi, workspaceId, teamId } = await ownWorkspace();
      await personApi.teams({ teamId }).projects.post({ name: 'Solo', key: 'SOL' });
      const ws = personApi.workspaces({ workspaceId });

      expect((await ws.get()).data).toMatchObject({ deletion: 'work' });
      expect((await ws.delete()).status).toBe(409);
    });

    it('keeps the instance workspace, and leaves deleting to the owner', async () => {
      const { ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);

      expect((await ownerApi.workspaces({ workspaceId }).get()).data).toMatchObject({
        deletion: 'instance',
      });
      expect((await ownerApi.workspaces({ workspaceId }).delete()).status).toBe(409);
      expect((await authedApi(admin.cookie).workspaces({ workspaceId }).delete()).status).toBe(403);
    });
  });

  describe('createOwnWorkspace', () => {
    afterEach(() => setOwnedWorkspaceLimit());

    it('keeps a person to one workspace unless the limit is raised', async () => {
      await setup();
      const person = await signUpTestUser({ team: false });
      const account = { id: person.userId, role: 'user' };

      await expect(createOwnWorkspace(account, 'Second')).rejects.toThrow(
        'You already own a workspace',
      );
      setOwnedWorkspaceLimit(0);
      expect(await createOwnWorkspace(account, 'Second')).toBeNumber();
    });

    it('leaves creation to the instance owner while personal workspaces are off', async () => {
      await setup();
      await setAuthSettings({ personalWorkspaces: false });
      const person = await signUpTestUser({ team: false });

      await expect(createOwnWorkspace({ id: person.userId, role: 'user' }, 'Acme')).rejects.toThrow(
        'Only the instance owner can create workspaces',
      );
    });
  });
});
