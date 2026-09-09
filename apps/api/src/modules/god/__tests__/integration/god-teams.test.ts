import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, createAgentUser, setup, type Actor } from '../helpers';

// The instance team directory under god mode: listing every team on the instance with
// what it holds, and reading one with the projects it owns and everyone in it. These
// routes read teams the caller does not belong to, so they sit behind the god guard
// like the rest of the plugin.

const PAGE = { page: 1, pageSize: 50 };

// Every account is given a team at registration, so the actor's own team is its first.
async function ownTeamId(actor: Actor): Promise<number> {
  const teams = await actor.api.teams.get();
  return teams.data![0]!.id;
}

describe('god teams', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('access', () => {
    it('refuses both routes for a user who is not the instance owner', async () => {
      await setup();
      const outsider = await addUser();
      const teamId = await ownTeamId(outsider);

      expect((await outsider.api.god.teams.get({ query: PAGE })).status).toBe(403);
      expect((await outsider.api.god.teams({ teamId }).get()).status).toBe(403);
    });
  });

  describe('list — GET /god/teams', () => {
    it('lists every team on the instance, including ones the owner is not in', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });
      await alice.api.teams.post({ name: 'Alice Only' });

      const res = await god.api.god.teams.get({ query: PAGE });

      expect(res.status).toBe(200);
      // The god's own team, Alice's registration team, and the one she created.
      expect(res.data?.total).toBe(3);
      expect(res.data?.items.map((one) => one.name)).toContain('Alice Only');
    });

    it('counts what a team holds', async () => {
      const { god } = await setup();
      const teamId = await ownTeamId(god);
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const view = await god.api.projects({ projectKey: 'MKT' }).get();
      await god.api.projects({ projectKey: 'MKT' }).issues.post({
        title: 'First',
        columnId: view.data!.columns[0]!.id,
      });
      await createAgentUser(god, 'MKT');

      const res = await god.api.god.teams.get({ query: PAGE });
      const row = res.data!.items.find((one) => one.id === teamId)!;

      expect(row).toMatchObject({
        projectCount: 1,
        issueCount: 1,
        agentCount: 1,
        mcpEnabled: true,
        // The owner and the agent's bot user, which belongs to the team too.
        memberCount: 2,
      });
    });

    it('leaves an archived issue out of the count', async () => {
      const { god } = await setup();
      const teamId = await ownTeamId(god);
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const view = await god.api.projects({ projectKey: 'MKT' }).get();
      const created = await god.api.projects({ projectKey: 'MKT' }).issues.post({
        title: 'Old',
        columnId: view.data!.columns[0]!.id,
      });
      await god.api.issues({ issueId: created.data!.id }).archive.post();

      const res = await god.api.god.teams.get({ query: PAGE });

      expect(res.data!.items.find((one) => one.id === teamId)?.issueCount).toBe(0);
    });

    it('matches the search term against the name', async () => {
      const { god } = await setup();
      await god.api.teams.post({ name: 'Marketing' });
      await god.api.teams.post({ name: 'Engineering' });

      const match = await god.api.god.teams.get({ query: { ...PAGE, search: 'market' } });
      const noMatch = await god.api.god.teams.get({ query: { ...PAGE, search: 'nothing' } });

      expect(match.data?.items.map((one) => one.name)).toEqual(['Marketing']);
      expect(match.data?.total).toBe(1);
      expect(noMatch.data?.items).toEqual([]);
      expect(noMatch.data?.total).toBe(0);
    });

    it('pages with limit and offset while the total stays the full match count', async () => {
      const { god } = await setup();
      await god.api.teams.post({ name: 'One' });
      await god.api.teams.post({ name: 'Two' });

      const first = await god.api.god.teams.get({ query: { page: 1, pageSize: 2 } });
      const second = await god.api.god.teams.get({ query: { page: 2, pageSize: 2 } });

      // The two created teams plus the one the god account registered with.
      expect(first.data?.items).toHaveLength(2);
      expect(second.data?.items).toHaveLength(1);
      expect(first.data?.total).toBe(3);
      expect(new Set([...first.data!.items, ...second.data!.items].map((one) => one.id)).size).toBe(
        3,
      );
    });

    it('rejects a page size outside the allowed range', async () => {
      const { god } = await setup();

      expect((await god.api.god.teams.get({ query: { ...PAGE, pageSize: 0 } })).status).toBe(400);
      expect((await god.api.god.teams.get({ query: { ...PAGE, pageSize: 500 } })).status).toBe(400);
    });
  });

  describe('detail — GET /god/teams/:teamId', () => {
    it('returns the counts of the team', async () => {
      const { god } = await setup();
      const teamId = await ownTeamId(god);
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await god.api.god.teams({ teamId }).get();

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: teamId, projectCount: 1, memberCount: 1 });
    });

    it('returns 404 for an unknown team and 400 for a non-numeric id', async () => {
      const { god } = await setup();

      expect((await god.api.god.teams({ teamId: 999999 }).get()).status).toBe(404);
      expect((await god.api.god.teams({ teamId: 'abc' }).get()).status).toBe(400);
    });
  });

  describe('projects — GET /god/teams/:teamId/projects', () => {
    it('lists the projects the team owns with what each holds', async () => {
      const { god } = await setup();
      const teamId = await ownTeamId(god);
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const view = await god.api.projects({ projectKey: 'MKT' }).get();
      await god.api.projects({ projectKey: 'MKT' }).issues.post({
        title: 'First',
        columnId: view.data!.columns[0]!.id,
      });

      const res = await god.api.god.teams({ teamId }).projects.get({ query: PAGE });

      expect(res.status).toBe(200);
      expect(res.data?.total).toBe(1);
      expect(res.data?.items[0]).toMatchObject({
        key: 'MKT',
        name: 'Marketing',
        memberCount: 1,
        issueCount: 1,
      });
    });

    it('matches the search term against the key or the name, and pages', async () => {
      const { god } = await setup();
      const teamId = await ownTeamId(god);
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await god.api.projects.post({ key: 'ENG', name: 'Engineering' });

      const byKey = await god.api.god
        .teams({ teamId })
        .projects.get({ query: { ...PAGE, search: 'mkt' } });
      const first = await god.api.god
        .teams({ teamId })
        .projects.get({ query: { page: 1, pageSize: 1 } });

      expect(byKey.data?.items.map((one) => one.key)).toEqual(['MKT']);
      expect(byKey.data?.total).toBe(1);
      // The window narrows, the total stays the full match count.
      expect(first.data?.items).toHaveLength(1);
      expect(first.data?.total).toBe(2);
    });

    it('refuses a user who is not the instance owner', async () => {
      await setup();
      const outsider = await addUser();
      const teamId = await ownTeamId(outsider);

      expect((await outsider.api.god.teams({ teamId }).projects.get({ query: PAGE })).status).toBe(
        403,
      );
    });
  });

  describe('members — GET /god/teams/:teamId/members', () => {
    it('lists everyone in the team with their rank, and flags an agent', async () => {
      const { god } = await setup();
      const teamId = await ownTeamId(god);
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const agentUserId = await createAgentUser(god, 'MKT');

      const res = await god.api.god.teams({ teamId }).members.get({ query: PAGE });

      expect(res.status).toBe(200);
      expect(res.data?.total).toBe(2);
      expect(res.data!.items.find((m) => m.userId === god.id)).toMatchObject({
        role: 'owner',
        isAgent: false,
      });
      expect(res.data!.items.find((m) => m.userId === agentUserId)).toMatchObject({
        role: 'agent',
        isAgent: true,
      });
    });

    it('matches the search term against the name or the address', async () => {
      const { god } = await setup();
      const teamId = await ownTeamId(god);

      const byEmail = await god.api.god
        .teams({ teamId })
        .members.get({ query: { ...PAGE, search: 'root@example' } });
      const noMatch = await god.api.god
        .teams({ teamId })
        .members.get({ query: { ...PAGE, search: 'nobody' } });

      expect(byEmail.data?.items.map((m) => m.userId)).toEqual([god.id]);
      expect(noMatch.data?.items).toEqual([]);
      expect(noMatch.data?.total).toBe(0);
    });

    it('refuses a user who is not the instance owner', async () => {
      await setup();
      const outsider = await addUser();
      const teamId = await ownTeamId(outsider);

      expect((await outsider.api.god.teams({ teamId }).members.get({ query: PAGE })).status).toBe(
        403,
      );
    });
  });
});
