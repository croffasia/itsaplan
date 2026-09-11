import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { api as anonApi, apiKeyApi, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createAgent } from '#tests/helpers/agents';
import { clearLimits, setLimits } from '#tests/helpers/limits';

// The teams feature owns list, create, detail, rename, and leave. Every account is
// given a team at registration, named after its username, so a fresh account already
// lists one.

async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

// Signs up a user, invites them into the team on the given rank and accepts for them.
async function addTeamMember(
  owner: { api: Api },
  teamId: number,
  role: 'manager' | 'member' = 'member',
) {
  const user = await signUpTestUser();
  const created = await owner.api.teams({ teamId }).invites.post({ email: user.email, role });
  const api = authedApi(user.cookie);
  await api.invites({ token: created.data!.token }).accept.post();
  return { user, api };
}

async function memberRole(api: Api, teamId: number, userId: string) {
  const list = await api.teams({ teamId }).members.get();
  return list.data?.items.find((one) => one.userId === userId)?.role;
}

describe('teams', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(clearLimits);

  describe('list', () => {
    it('lists the team the account was registered with', async () => {
      const { user, api } = await signUpClient();

      const list = await api.teams.get();
      expect(list.status).toBe(200);
      expect(list.data).toHaveLength(1);
      expect(list.data?.[0]).toMatchObject({
        name: user.username,
        role: 'owner',
        memberCount: 1,
        ownerCount: 1,
        projectCount: 0,
      });
    });

    it('counts the projects the team owns', async () => {
      const { api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });

      const list = await api.teams.get();
      expect(list.data?.[0]).toMatchObject({ projectCount: 1 });
    });

    it("lists only the caller's own teams", async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      await other.api.teams.post({ name: 'Design' });

      const list = await api.teams.get();
      expect(list.data?.map((t) => t.name)).not.toContain('Design');
    });

    it('rejects a request without a session', async () => {
      const list = await anonApi.teams.get();
      expect(list.status).toBe(401);
    });
  });

  describe('create', () => {
    it('creates a team with the caller as its owner', async () => {
      const { api } = await signUpClient();

      const created = await api.teams.post({ name: 'Design' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ name: 'Design', role: 'owner' });

      const list = await api.teams.get();
      expect(list.data).toHaveLength(2);
      expect(list.data?.map((t) => t.name)).toContain('Design');
    });

    it('trims the name', async () => {
      const { api } = await signUpClient();

      const created = await api.teams.post({ name: '  Design  ' });
      expect(created.data).toMatchObject({ name: 'Design' });
    });

    it('rejects an empty or blank name', async () => {
      const { api } = await signUpClient();

      expect((await api.teams.post({ name: '' })).status).toBe(400);
      expect((await api.teams.post({ name: '   ' })).status).toBe(400);
    });

    it('rejects a name longer than 60 characters', async () => {
      const { api } = await signUpClient();

      expect((await api.teams.post({ name: 'a'.repeat(60) })).status).toBe(201);
      expect((await api.teams.post({ name: 'a'.repeat(61) })).status).toBe(400);
    });

    it('refuses one more team than the limits allow', async () => {
      const { api } = await signUpClient();
      // The account already owns the team it was registered with.
      setLimits({ maxTeams: 1 });

      const created = await api.teams.post({ name: 'Design' });
      expect(created.status).toBe(409);
      expect(await api.teams.get().then((list) => list.data)).toHaveLength(1);
    });

    it('rejects a request without a session', async () => {
      const created = await anonApi.teams.post({ name: 'Design' });
      expect(created.status).toBe(401);
    });
  });

  describe('detail', () => {
    it('returns the team with what it holds and what the caller may do', async () => {
      const { user, api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId }).get();
      expect(detail.status).toBe(200);
      expect(detail.data).toMatchObject({
        name: user.username,
        role: 'owner',
        projectCount: 1,
        memberCount: 1,
        roleCount: 1,
        integrationCount: 0,
      });
      expect(detail.data?.permissions).toBeDefined();
    });

    it('lists the members and the projects of the team by their own routes', async () => {
      const { user, api } = await signUpClient();
      await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const members = await api.teams({ teamId }).members.get();
      expect(members.data?.items).toMatchObject([{ email: user.email, role: 'owner' }]);

      const projects = await api.teams({ teamId }).projects.get();
      expect(projects.data?.items).toMatchObject([
        { key: 'MKT', name: 'Marketing', memberCount: 1, isMember: true },
      ]);
    });

    it('windows the member list, searches it and narrows it to the people', async () => {
      const { user, api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      await addTeamMember({ api }, teamId);
      await addTeamMember({ api }, teamId);
      const members = api.teams({ teamId }).members;

      const first = await members.get({ query: { page: 1, pageSize: 2 } });
      expect(first.data?.items).toHaveLength(2);
      expect(first.data?.total).toBe(3);

      const second = await members.get({ query: { page: 2, pageSize: 2 } });
      expect(second.data?.items).toHaveLength(1);

      const found = await members.get({ query: { search: user.email } });
      expect(found.data?.items).toMatchObject([{ email: user.email }]);

      expect((await members.get({ query: { kind: 'human' } })).data?.total).toBe(3);
      expect((await members.get({ query: { kind: 'agent' } })).data?.total).toBe(0);
    });

    it('carries the owners and the managers of the team on its detail', async () => {
      const { user, api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const manager = await addTeamMember({ api }, teamId, 'manager');
      await addTeamMember({ api }, teamId);

      const detail = await api.teams({ teamId }).get();
      expect(detail.data?.leads).toMatchObject([
        { email: user.email, role: 'owner' },
        { email: manager.user.email, role: 'manager' },
      ]);
    });

    it('lists a member only the projects they joined, and the manager all of them', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      const member = await addTeamMember({ api }, teamId);
      const manager = await addTeamMember({ api }, teamId, 'manager');
      await api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });

      const mine = await member.api.teams({ teamId }).projects.get();
      expect(mine.data?.items.map((p) => p.key)).toEqual(['MKT']);
      expect((await member.api.teams.get()).data?.[0]).toMatchObject({ projectCount: 1 });

      const all = await manager.api.teams({ teamId }).projects.get();
      expect(all.data?.items.map((p) => p.key)).toEqual(['MKT', 'OPS']);
      expect((await manager.api.teams.get()).data?.[0]).toMatchObject({ projectCount: 2 });
    });

    it('pages the project list, counting every project the caller reads', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });

      const res = await api.teams({ teamId }).projects.get({ query: { page: 2, pageSize: 1 } });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ total: 2, page: 2, pageSize: 1 });
      expect(res.data?.items.map((p) => p.key)).toEqual(['OPS']);
    });

    it('searches the projects by key and by name', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });

      const byName = await api.teams({ teamId }).projects.get({ query: { search: 'market' } });
      expect(byName.data).toMatchObject({ total: 1 });
      expect(byName.data?.items.map((p) => p.key)).toEqual(['MKT']);

      const byKey = await api.teams({ teamId }).projects.get({ query: { search: 'ops' } });
      expect(byKey.data?.items.map((p) => p.key)).toEqual(['OPS']);
    });

    it('answers the options route with every project the caller reads', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      const member = await addTeamMember({ api }, teamId);
      await api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });

      const all = await api.teams({ teamId }).projects.options.get();
      expect(all.data).toMatchObject([
        { key: 'MKT', mcpEnabled: true },
        { key: 'OPS', mcpEnabled: true },
      ]);

      const mine = await member.api.teams({ teamId }).projects.options.get();
      expect(mine.data?.map((p) => p.key)).toEqual(['MKT']);
    });

    it('hides a project detail from a member who did not join it', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const project = await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addTeamMember({ api }, teamId);

      const denied = await member.api
        .teams({ teamId })
        .projects({ projectId: project.data!.id })
        .get();
      expect(denied.status).toBe(404);

      await api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });
      const allowed = await member.api
        .teams({ teamId })
        .projects({ projectId: project.data!.id })
        .get();
      expect(allowed.status).toBe(200);
    });

    it('hides the members and the projects of a team the caller is not in', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      expect((await api.teams({ teamId: otherTeamId }).members.get()).status).toBe(404);
      expect((await api.teams({ teamId: otherTeamId }).projects.get()).status).toBe(404);
    });

    it('hides a team the caller is not a member of', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId: otherTeamId }).get();
      expect(detail.status).toBe(404);
    });

    it('404s for an unknown team', async () => {
      const { api } = await signUpClient();

      expect((await api.teams({ teamId: 999999 }).get()).status).toBe(404);
    });
  });

  describe('project detail', () => {
    it("returns the reader's own access to a project the team owns", async () => {
      const { api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api.teams({ teamId }).projects({ projectId: project.data!.id }).get();
      expect(detail.status).toBe(200);
      expect(detail.data?.viewer?.role).toBe('owner');
      expect(detail.data?.viewer?.permissions.work_items.delete).toBe(true);
    });

    it('counts the open issues of the project and reports its last activity', async () => {
      const { api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;

      const empty = await api.teams({ teamId }).projects({ projectId: project.data!.id }).get();
      expect(empty.data?.stats).toMatchObject({ open: 0 });
      expect(empty.data?.lastActivityAt).toBeNull();

      const columnId = (await api.projects({ projectKey: 'MKT' }).get()).data!.columns[0].id;
      await api.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'First' });

      const detail = await api.teams({ teamId }).projects({ projectId: project.data!.id }).get();
      expect(detail.data?.stats).toMatchObject({ open: 1 });
      expect(detail.data?.lastActivityAt).not.toBeNull();
    });

    it("404s for a project of another account's team", async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
      const teamId = (await api.teams.get()).data![0].id;

      const detail = await api
        .teams({ teamId })
        .projects({ projectId: otherProject.data!.id })
        .get();
      expect(detail.status).toBe(404);
    });

    it('404s for a team the caller is not a member of', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      const detail = await api
        .teams({ teamId: otherTeamId })
        .projects({ projectId: otherProject.data!.id })
        .get();
      expect(detail.status).toBe(404);
    });
  });

  describe('project members', () => {
    it('lists the owners of the project before its members', async () => {
      const { user, api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const promoted = await addProjectMember(api, 'MKT');
      const promotedUserId = (
        await api.projects({ projectKey: 'MKT' }).members.get()
      ).data!.items.find((m) => m.email !== user.email)!.userId;
      await api
        .projects({ projectKey: 'MKT' })
        .members({ userId: promotedUserId })
        .patch({ role: 'owner' });
      // The account that created the project joined first, so it heads the list until
      // the other owner demotes it.
      await promoted
        .projects({ projectKey: 'MKT' })
        .members({ userId: user.userId })
        .patch({ role: 'member' });
      const teamId = (await api.teams.get()).data![0].id;

      const page = await api
        .teams({ teamId })
        .projects({ projectId: project.data!.id })
        .members.get();
      expect(page.status).toBe(200);
      expect(page.data?.total).toBe(2);
      expect(page.data?.items.map((m) => m.role)).toEqual(['owner', 'member']);
      expect(page.data?.items[0]).toMatchObject({ userId: promotedUserId, isAgent: false });
    });

    it('windows the list and reports how many there are in total', async () => {
      const { user, api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      await addProjectMember(api, 'MKT');
      await addProjectMember(api, 'MKT');
      const teamId = (await api.teams.get()).data![0].id;
      const members = api.teams({ teamId }).projects({ projectId: project.data!.id }).members;

      // The owner joined first and would end up on the last page under the newest-first
      // rule alone, so the ordering has to run in the database rather than on the page.
      const first = await members.get({ query: { page: 1, pageSize: 2 } });
      expect(first.data?.items).toHaveLength(2);
      expect(first.data?.total).toBe(3);
      expect(first.data?.items[0]).toMatchObject({ userId: user.userId, role: 'owner' });

      const second = await members.get({ query: { page: 2, pageSize: 2 } });
      expect(second.data?.items).toHaveLength(1);
      expect(second.data?.total).toBe(3);
      expect(second.data?.items[0].role).toBe('member');
    });

    it('narrows the list to the people or to the AI agents', async () => {
      const { api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      await addProjectMember(api, 'MKT');
      const teamId = (await api.teams.get()).data![0].id;
      const members = api.teams({ teamId }).projects({ projectId: project.data!.id }).members;

      const people = await members.get({ query: { kind: 'human' } });
      expect(people.data?.total).toBe(2);

      const agents = await members.get({ query: { kind: 'agent' } });
      expect(agents.data).toMatchObject({ items: [], total: 0 });
    });

    it('searches by name, address and handle', async () => {
      const { user, api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      await addProjectMember(api, 'MKT');
      const teamId = (await api.teams.get()).data![0].id;
      const members = api.teams({ teamId }).projects({ projectId: project.data!.id }).members;

      const byEmail = await members.get({ query: { search: user.email } });
      expect(byEmail.data?.total).toBe(1);
      expect(byEmail.data?.items[0].email).toBe(user.email);

      const byHandle = await members.get({ query: { search: user.username } });
      expect(byHandle.data?.items.map((m) => m.email)).toEqual([user.email]);

      const none = await members.get({ query: { search: 'nobody-by-that-name' } });
      expect(none.data).toMatchObject({ items: [], total: 0 });
    });

    it('404s for a member of the team who is not in the project', async () => {
      const { api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;
      const outsider = await addTeamMember({ api }, teamId);

      const page = await outsider.api
        .teams({ teamId })
        .projects({ projectId: project.data!.id })
        .members.get();
      expect(page.status).toBe(404);
    });

    it('lets a manager of the team read a project they are not in', async () => {
      const { api } = await signUpClient();
      const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
      const teamId = (await api.teams.get()).data![0].id;
      const manager = await addTeamMember({ api }, teamId, 'manager');

      const page = await manager.api
        .teams({ teamId })
        .projects({ projectId: project.data!.id })
        .members.get();
      expect(page.status).toBe(200);
      expect(page.data?.total).toBe(1);
    });
  });

  describe('team projects', () => {
    // The team the account was registered with, which owns the projects it creates.
    async function ownTeamId(api: Api): Promise<number> {
      return (await api.teams.get()).data![0].id;
    }

    describe('create', () => {
      it('creates a project the team owns, with the caller as its owner', async () => {
        const { user, api } = await signUpClient();
        const teamId = await ownTeamId(api);

        const created = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });
        expect(created.status).toBe(201);
        expect(created.data).toMatchObject({ key: 'MKT', teamId, teamName: user.username });

        const projects = await api.teams({ teamId }).projects.get();
        expect(projects.data?.items).toMatchObject([{ key: 'MKT', isMember: true }]);
      });

      it('rejects a duplicate project key', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Marketing' });

        const dup = await api.teams({ teamId }).projects.post({ key: 'MKT', name: 'Other' });
        expect(dup.status).toBe(409);
      });

      it("404s for another account's team", async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherTeamId = await ownTeamId(other.api);

        const created = await api
          .teams({ teamId: otherTeamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });
        expect(created.status).toBe(404);
        expect(
          (await other.api.teams({ teamId: otherTeamId }).projects.get()).data?.items,
        ).toHaveLength(0);
      });
    });

    describe('copy', () => {
      it("copies a project of the team into the same team's new project", async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const source = await api.teams({ teamId }).projects.post({ key: 'SRC', name: 'Source' });
        await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'bug', color: '#ff0000' });

        const copied = await api
          .teams({ teamId })
          .projects({ projectId: source.data!.id })
          .copy.post({ key: 'DST', name: 'Destination' });
        expect(copied.status).toBe(201);
        expect(copied.data).toMatchObject({ key: 'DST', teamId });

        const view = await api.projects({ projectKey: 'DST' }).get();
        expect(view.data?.labels.map((l) => l.name)).toEqual(['bug']);
      });

      it("404s for a project of another account's team", async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
        const teamId = await ownTeamId(api);

        const copied = await api
          .teams({ teamId })
          .projects({ projectId: otherProject.data!.id })
          .copy.post({ key: 'DST', name: 'Destination' });
        expect(copied.status).toBe(404);
      });
    });

    describe('update', () => {
      it('renames a project the team owns', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const project = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });

        const updated = await api
          .teams({ teamId })
          .projects({ projectId: project.data!.id })
          .patch({ name: 'Growth', description: 'What we ship' });
        expect(updated.status).toBe(200);
        expect(updated.data).toMatchObject({ key: 'MKT', name: 'Growth' });

        const projects = await api.teams({ teamId }).projects.get();
        expect(projects.data?.items).toMatchObject([
          { key: 'MKT', name: 'Growth', description: 'What we ship' },
        ]);
      });

      it("404s for a project of another account's team", async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
        const teamId = await ownTeamId(api);

        const updated = await api
          .teams({ teamId })
          .projects({ projectId: otherProject.data!.id })
          .patch({ name: 'Growth' });
        expect(updated.status).toBe(404);
        expect((await other.api.projects.get()).data?.[0]).toMatchObject({ name: 'Other' });
      });

      it('rejects an empty name', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const project = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });

        const updated = await api
          .teams({ teamId })
          .projects({ projectId: project.data!.id })
          .patch({ name: '' });
        expect(updated.status).toBe(400);
      });
    });

    describe('delete', () => {
      it('deletes a project the team owns', async () => {
        const { api } = await signUpClient();
        const teamId = await ownTeamId(api);
        const project = await api
          .teams({ teamId })
          .projects.post({ key: 'MKT', name: 'Marketing' });

        const deleted = await api
          .teams({ teamId })
          .projects({ projectId: project.data!.id })
          .delete();
        expect(deleted.status).toBe(204);
        expect((await api.teams({ teamId }).projects.get()).data?.items).toHaveLength(0);
        expect((await api.projects.get()).data).toHaveLength(0);
      });

      it('404s for a project of another team, leaving it in place', async () => {
        const { api } = await signUpClient();
        const other = await signUpClient();
        const otherProject = await other.api.projects.post({ key: 'OTH', name: 'Other' });
        const teamId = await ownTeamId(api);

        const deleted = await api
          .teams({ teamId })
          .projects({ projectId: otherProject.data!.id })
          .delete();
        expect(deleted.status).toBe(404);
        expect((await other.api.projects.get()).data).toHaveLength(1);
      });
    });
  });

  describe('mcp settings', () => {
    // Marks a request as an MCP tool dispatch, the way the MCP endpoint marks its own
    // in-process requests. Forged here to reach the team-scoped gate without /mcp.
    const asMcp = { headers: { 'x-mcp-loopback': '1' } };

    it('starts with MCP on and every project covered', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const project = (await api.projects.post({ key: 'MKT', name: 'Marketing' })).data!;

      expect((await api.teams.get()).data?.[0]).toMatchObject({ mcpEnabled: true });
      expect((await api.teams({ teamId }).projects.get()).data?.items).toMatchObject([
        { id: project.id, mcpEnabled: true },
      ]);
    });

    it('sets the switch and the covered projects in one call', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const on = (await api.projects.post({ key: 'ON', name: 'On' })).data!;
      const off = (await api.projects.post({ key: 'OFF', name: 'Off' })).data!;

      const res = await api.teams({ teamId }).mcp.patch({
        enabled: false,
        projects: [
          { projectId: on.id, enabled: true },
          { projectId: off.id, enabled: false },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        enabled: false,
        projects: [
          { projectId: off.id, enabled: false },
          { projectId: on.id, enabled: true },
        ],
      });
      // The switch reaches the team list, which is what the UI reads it from.
      expect((await api.teams.get()).data?.[0]).toMatchObject({ mcpEnabled: false });
    });

    it('ignores a project of another team', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const other = await signUpClient();
      const foreign = (await other.api.projects.post({ key: 'OTH', name: 'Other' })).data!;

      const res = await api.teams({ teamId }).mcp.patch({
        projects: [{ projectId: foreign.id, enabled: false }],
      });
      expect(res.status).toBe(200);
      expect(res.data?.projects).toEqual([]);

      // The other team's own project keeps its reach.
      const otherTeamId = (await other.api.teams.get()).data![0].id;
      expect(
        (await other.api.teams({ teamId: otherTeamId }).projects.get()).data?.items,
      ).toMatchObject([{ id: foreign.id, mcpEnabled: true }]);
    });

    it('lets a manager write the settings', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const project = (await owner.api.projects.post({ key: 'MKT', name: 'Marketing' })).data!;
      const manager = await addTeamMember(owner, teamId, 'manager');

      const res = await manager.api.teams({ teamId }).mcp.patch({
        enabled: false,
        projects: [{ projectId: project.id, enabled: false }],
      });
      expect(res.status).toBe(200);
      expect((await owner.api.teams.get()).data?.[0]).toMatchObject({ mcpEnabled: false });
    });

    it('lets a member read the state but not write it', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addProjectMember(owner.api, 'MKT');

      expect((await member.teams({ teamId }).projects.get()).data?.items).toMatchObject([
        { key: 'MKT', mcpEnabled: true },
      ]);
      expect((await member.teams({ teamId }).mcp.patch({ enabled: false })).status).toBe(403);
    });

    it("closes the team's own resources to MCP once the switch is off", async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      expect((await api.teams({ teamId })['ai-agents'].get(asMcp)).status).toBe(200);
      await api.teams({ teamId }).mcp.patch({ enabled: false });

      // The web app still reaches them; only the MCP surface closes.
      expect((await api.teams({ teamId })['ai-agents'].get()).status).toBe(200);
      const blocked = await api.teams({ teamId })['ai-agents'].get(asMcp);
      expect(blocked.status).toBe(403);
      expect((blocked.error?.value as { error: string }).error).toBe(
        'MCP is disabled for this team',
      );
    });

    it('hides a team with MCP off from an MCP list_teams call', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;
      const second = (await api.teams.post({ name: 'Growth' })).data!;
      await api.teams({ teamId }).mcp.patch({ enabled: false });

      expect((await api.teams.get()).data?.map((t) => t.id).sort()).toEqual(
        [teamId, second.id].sort(),
      );
      expect((await api.teams.get(asMcp)).data?.map((t) => t.id)).toEqual([second.id]);
    });
  });

  describe('rename', () => {
    it('renames a team the caller owns', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      const renamed = await api.teams({ teamId }).patch({ name: '  Growth  ' });
      expect(renamed.status).toBe(200);
      expect(renamed.data).toMatchObject({ name: 'Growth' });

      const list = await api.teams.get();
      expect(list.data?.[0]).toMatchObject({ name: 'Growth' });
    });

    it('rejects a blank name', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      expect((await api.teams({ teamId }).patch({ name: '   ' })).status).toBe(400);
    });

    it("rejects a rename of another account's team", async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      const renamed = await api.teams({ teamId: otherTeamId }).patch({ name: 'Growth' });
      expect(renamed.status).toBe(404);
    });
  });

  describe('member rank', () => {
    it('promotes a member to manager', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const member = await addTeamMember(owner, teamId);

      const patched = await owner.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .patch({ role: 'manager' });
      expect(patched.status).toBe(204);
      expect(await memberRole(owner.api, teamId, member.user.userId)).toBe('manager');
    });

    it('lets a manager change a plain member, but not grant the owner rank', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const manager = await addTeamMember(owner, teamId, 'manager');
      const member = await addTeamMember(owner, teamId);

      const promoted = await manager.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .patch({ role: 'owner' });
      expect(promoted.status).toBe(403);

      const demoted = await manager.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member' });
      expect(demoted.status).toBe(403);

      const changed = await manager.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .patch({ role: 'manager' });
      expect(changed.status).toBe(204);
    });

    it('rejects changing your own rank, and keeps an owner in place', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const second = await addTeamMember(owner, teamId);
      await owner.api
        .teams({ teamId })
        .members({ userId: second.user.userId })
        .patch({ role: 'owner' });

      const self = await owner.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member' });
      expect(self.status).toBe(409);

      // Demoting an owner takes a second owner, which is what leaves the team one.
      const demoted = await second.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member' });
      expect(demoted.status).toBe(204);
      expect(await memberRole(owner.api, teamId, owner.user.userId)).toBe('member');
    });

    it('403s for a plain member', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const member = await addTeamMember(owner, teamId);
      const other = await addTeamMember(owner, teamId);

      const patched = await member.api
        .teams({ teamId })
        .members({ userId: other.user.userId })
        .patch({ role: 'manager' });
      expect(patched.status).toBe(403);
    });
  });

  describe('remove a member', () => {
    it('drops the member and their access to the projects of the team', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addTeamMember(owner, teamId);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });

      const removed = await owner.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .delete();
      expect(removed.status).toBe(204);

      const members = await owner.api.teams({ teamId }).members.get();
      expect(members.data?.items.some((one) => one.userId === member.user.userId)).toBe(false);
      expect((await member.api.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
      expect((await member.api.teams.get()).data?.some((one) => one.id === teamId)).toBe(false);
    });

    it('rejects removing yourself, and 404s for someone outside the team', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const outsider = await signUpClient();

      const self = await owner.api
        .teams({ teamId })
        .members({ userId: owner.user.userId })
        .delete();
      expect(self.status).toBe(409);

      const stranger = await owner.api
        .teams({ teamId })
        .members({ userId: outsider.user.userId })
        .delete();
      expect(stranger.status).toBe(404);
    });

    it('403s for a manager', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const manager = await addTeamMember(owner, teamId, 'manager');
      const member = await addTeamMember(owner, teamId);

      const removed = await manager.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .delete();
      expect(removed.status).toBe(403);
    });

    // The removal takes their project memberships with it, so it is refused where one
    // of them is a project's only owner — the same rule the project's member list
    // holds to.
    it('rejects removing the only owner of a project of the team', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const member = await addTeamMember(owner, teamId);
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'owner' });
      // The team's owner created MKT, so they own it too; only the second project
      // leaves the member alone on it.
      await owner.api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      await owner.api
        .projects({ projectKey: 'OPS' })
        .members.post({ userId: member.user.userId, role: 'owner' });
      await owner.api
        .projects({ projectKey: 'OPS' })
        .members({ userId: owner.user.userId })
        .delete();

      const removed = await owner.api
        .teams({ teamId })
        .members({ userId: member.user.userId })
        .delete();
      expect(removed.status).toBe(409);
      expect(removed.error?.value).toMatchObject({ error: expect.stringContaining('OPS') });
      expect((await member.api.projects({ projectKey: 'OPS' }).get()).status).toBe(200);
    });
  });

  describe('concurrent ownership changes', () => {
    async function twoOwners() {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const second = await addTeamMember(owner, teamId);
      await owner.api
        .teams({ teamId })
        .members({ userId: second.user.userId })
        .patch({ role: 'owner' });
      return { owner, second, teamId };
    }

    it('keeps an owner when both owners leave concurrently', async () => {
      const { owner, second, teamId } = await twoOwners();
      const results = await Promise.all([
        owner.api.teams({ teamId }).leave.post(),
        second.api.teams({ teamId }).leave.post(),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([204, 409]);
      const teams = await Promise.all([owner.api.teams.get(), second.api.teams.get()]);
      expect(
        teams.flatMap((result) => result.data ?? []).filter((row) => row.id === teamId),
      ).toHaveLength(1);
    });

    it('keeps an owner when owners demote each other concurrently', async () => {
      const { owner, second, teamId } = await twoOwners();
      const results = await Promise.all([
        owner.api
          .teams({ teamId })
          .members({ userId: second.user.userId })
          .patch({ role: 'member' }),
        second.api
          .teams({ teamId })
          .members({ userId: owner.user.userId })
          .patch({ role: 'member' }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([204, 403]);
      expect((await owner.api.teams({ teamId }).get()).data?.ownerCount).toBe(1);
    });

    it('keeps an owner when owners remove each other concurrently', async () => {
      const { owner, second, teamId } = await twoOwners();
      const results = await Promise.all([
        owner.api.teams({ teamId }).members({ userId: second.user.userId }).delete(),
        second.api.teams({ teamId }).members({ userId: owner.user.userId }).delete(),
      ]);
      expect(results.filter((result) => result.status === 204)).toHaveLength(1);
      expect(results.some((result) => result.status === 403 || result.status === 404)).toBe(true);
    });
  });

  describe('leave', () => {
    it('rejects the last owner leaving', async () => {
      const { api } = await signUpClient();
      const teamId = (await api.teams.get()).data![0].id;

      const left = await api.teams({ teamId }).leave.post();
      expect(left.status).toBe(409);
      expect((await api.teams.get()).data).toHaveLength(1);
    });

    it('takes the projects of the team with it', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const member = await addTeamMember(owner, teamId);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: member.user.userId, role: 'member' });

      expect((await member.api.teams({ teamId }).leave.post()).status).toBe(204);
      expect((await member.api.projects({ projectKey: 'MKT' }).get()).status).toBe(403);
    });

    it('404s for a team the caller is not a member of', async () => {
      const { api } = await signUpClient();
      const other = await signUpClient();
      const otherTeamId = (await other.api.teams.get()).data![0].id;

      expect((await api.teams({ teamId: otherTeamId }).leave.post()).status).toBe(404);
    });

    it('rejects leaving while the only owner of a project of the team', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      const member = await addTeamMember(owner, teamId);
      await owner.api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      await owner.api
        .projects({ projectKey: 'OPS' })
        .members.post({ userId: member.user.userId, role: 'owner' });
      await owner.api
        .projects({ projectKey: 'OPS' })
        .members({ userId: owner.user.userId })
        .delete();

      const left = await member.api.teams({ teamId }).leave.post();
      expect(left.status).toBe(409);
      expect((await member.api.projects({ projectKey: 'OPS' }).get()).status).toBe(200);
    });

    it('rejects an agent leaving with its own key', async () => {
      const owner = await signUpClient();
      const teamId = (await owner.api.teams.get()).data![0].id;
      await owner.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const created = await createAgent(owner.api, 'MKT', {
        name: 'Runner',
        username: 'runner',
        kind: 'external',
      });
      const agentApi = apiKeyApi(created.data!.apiKey!);

      expect((await agentApi.teams({ teamId }).leave.post()).status).toBe(409);
      const members = await owner.api.teams({ teamId }).members.get();
      expect(members.data?.items.some((one) => one.role === 'agent')).toBe(true);
    });
  });
});
