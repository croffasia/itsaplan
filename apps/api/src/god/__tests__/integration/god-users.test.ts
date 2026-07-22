import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from '../../../__tests__/helpers/db';
import { addUser, createAgentUser, joinProject, setup } from '../helpers';

// The instance user directory under god mode: listing every account on the instance,
// reading one with the projects it can reach, confirming an email address on the
// owner's behalf, and deleting an account. These routes read across the better-auth
// tables and every project's membership, which no project-scoped route may do, so the
// whole plugin sits behind the god guard.

const ALL = { kind: 'all' as const, limit: 50, offset: 0 };

describe('god users', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('access', () => {
    it('refuses every route for a user who is not the instance owner', async () => {
      const { god } = await setup();
      const outsider = await addUser();

      expect((await outsider.api.god.users.get({ query: ALL })).status).toBe(403);
      expect((await outsider.api.god.users({ userId: god.id }).get()).status).toBe(403);
      expect((await outsider.api.god.users({ userId: god.id })['verify-email'].post()).status).toBe(
        403,
      );
      expect((await outsider.api.god.users({ userId: god.id }).delete()).status).toBe(403);
    });
  });

  describe('list — GET /god/users', () => {
    it('reports the sign-in state and project count of each account', async () => {
      const { god } = await setup();
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await god.api.god.users.get({ query: ALL });

      expect(res.status).toBe(200);
      expect(res.data?.total).toBe(1);
      expect(res.data?.items[0]).toMatchObject({
        id: god.id,
        email: 'root@example.com',
        name: 'Root',
        role: 'god',
        isAgent: false,
        emailVerified: false,
        // Signing up links the password provider and opens a session.
        providers: ['credential'],
        projectCount: 1,
      });
      expect(res.data?.items[0].lastSeenAt).not.toBeNull();
    });

    it('lists people by default and agent bot users only when asked', async () => {
      const { god } = await setup();
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const agentUserId = await createAgentUser(god, 'MKT');

      const humans = await god.api.god.users.get({
        query: { kind: 'human', limit: 50, offset: 0 },
      });
      const agents = await god.api.god.users.get({
        query: { kind: 'agent', limit: 50, offset: 0 },
      });
      const all = await god.api.god.users.get({ query: ALL });

      expect(humans.data?.total).toBe(1);
      expect(humans.data?.items.map((u) => u.id)).toEqual([god.id]);

      expect(agents.data?.total).toBe(1);
      expect(agents.data?.items[0]).toMatchObject({ id: agentUserId, isAgent: true });

      expect(all.data?.total).toBe(2);
      expect(all.data?.items.map((u) => u.id).sort()).toEqual([god.id, agentUserId].sort());
    });

    it('defaults to people when no kind is given', async () => {
      const { god } = await setup();
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await createAgentUser(god, 'MKT');

      const res = await god.api.god.users.get({ query: {} });

      expect(res.status).toBe(200);
      expect(res.data?.total).toBe(1);
      expect(res.data?.items.map((u) => u.id)).toEqual([god.id]);
    });

    it('matches the search term against the name or the email', async () => {
      const { god } = await setup();
      await addUser({ name: 'Alice Smith', email: 'alice@example.com' });
      await addUser({ name: 'Bob Jones', email: 'bob@corp.test' });

      const byName = await god.api.god.users.get({ query: { ...ALL, search: 'alice' } });
      const byEmail = await god.api.god.users.get({ query: { ...ALL, search: 'corp.test' } });
      const noMatch = await god.api.god.users.get({ query: { ...ALL, search: 'nobody' } });

      expect(byName.data?.items.map((u) => u.email)).toEqual(['alice@example.com']);
      expect(byEmail.data?.items.map((u) => u.email)).toEqual(['bob@corp.test']);
      expect(noMatch.data?.items).toEqual([]);
      // The total counts the matches, not every account.
      expect(byName.data?.total).toBe(1);
      expect(noMatch.data?.total).toBe(0);
    });

    it('pages with limit and offset while the total stays the full match count', async () => {
      const { god } = await setup();
      await addUser();
      await addUser();

      const first = await god.api.god.users.get({ query: { ...ALL, limit: 2, offset: 0 } });
      const second = await god.api.god.users.get({ query: { ...ALL, limit: 2, offset: 2 } });

      expect(first.data?.items).toHaveLength(2);
      expect(second.data?.items).toHaveLength(1);
      expect(first.data?.total).toBe(3);
      expect(second.data?.total).toBe(3);
      // The two windows together cover every account exactly once.
      const paged = [...first.data!.items, ...second.data!.items].map((u) => u.id);
      expect(new Set(paged).size).toBe(3);
    });

    it('rejects a limit outside the allowed range', async () => {
      const { god } = await setup();

      expect((await god.api.god.users.get({ query: { ...ALL, limit: 0 } })).status).toBe(400);
      expect((await god.api.god.users.get({ query: { ...ALL, limit: 500 } })).status).toBe(400);
    });
  });

  describe('detail — GET /god/users/:userId', () => {
    it('resolves an owner membership to full permissions', async () => {
      const { god } = await setup();
      const alice = await addUser({ name: 'Alice', email: 'alice@example.com' });
      await alice.api.projects.post({ key: 'MKT', name: 'Marketing' });

      const res = await god.api.god.users({ userId: alice.id }).get();

      expect(res.status).toBe(200);
      expect(res.data?.projects).toHaveLength(1);
      expect(res.data?.projects[0]).toMatchObject({
        projectKey: 'MKT',
        projectName: 'Marketing',
        role: 'owner',
        roleId: null,
        roleName: null,
        // Alice is the only owner, so deleting her would leave MKT unmanaged.
        ownerCount: 1,
      });
      // An owner bypasses the matrix, so every resource comes back granted.
      expect(res.data?.projects[0].permissions.work_items.create).toBe(true);
      expect(res.data?.projects[0].permissions.members_manage.delete).toBe(true);
    });

    it("resolves a member membership to the assigned role's matrix", async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });
      const bob = await addUser({ email: 'bob@example.com' });
      await alice.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await joinProject(alice, bob, 'MKT', 'member');

      const res = await god.api.god.users({ userId: bob.id }).get();

      expect(res.status).toBe(200);
      expect(res.data?.projects[0]).toMatchObject({
        projectKey: 'MKT',
        role: 'member',
        roleName: 'Member',
        ownerCount: 1,
      });
      // The default Member role: full work items, no member management.
      expect(res.data?.projects[0].permissions.work_items.create).toBe(true);
      expect(res.data?.projects[0].permissions.members_manage.read).toBe(false);
    });

    it('counts every owner of a shared project', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });
      const bob = await addUser({ email: 'bob@example.com' });
      await alice.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await joinProject(alice, bob, 'MKT', 'owner');

      const res = await god.api.god.users({ userId: alice.id }).get();

      expect(res.data?.projects[0]).toMatchObject({ role: 'owner', ownerCount: 2 });
    });

    it('returns an account with no memberships as reachable by nothing', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });

      const res = await god.api.god.users({ userId: alice.id }).get();

      expect(res.status).toBe(200);
      expect(res.data?.projects).toEqual([]);
      expect(res.data?.projectCount).toBe(0);
    });

    it('404s for an unknown id', async () => {
      const { god } = await setup();

      const res = await god.api.god.users({ userId: 'no-such-user' }).get();

      expect(res.status).toBe(404);
    });
  });

  describe('verify email — POST /god/users/:userId/verify-email', () => {
    it('marks the address confirmed and reports it on the list too', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });

      const before = await god.api.god.users({ userId: alice.id }).get();
      expect(before.data?.emailVerified).toBe(false);

      const res = await god.api.god.users({ userId: alice.id })['verify-email'].post();

      expect(res.status).toBe(200);
      expect(res.data?.emailVerified).toBe(true);

      const listed = await god.api.god.users.get({ query: { ...ALL, search: 'alice@' } });
      expect(listed.data?.items[0]?.emailVerified).toBe(true);
    });

    it('404s for an unknown id', async () => {
      const { god } = await setup();

      const res = await god.api.god.users({ userId: 'no-such-user' })['verify-email'].post();

      expect(res.status).toBe(404);
    });
  });

  describe('delete — DELETE /god/users/:userId', () => {
    it('removes an account that owns nothing on its own', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });

      const res = await god.api.god.users({ userId: alice.id }).delete();

      expect(res.status).toBe(204);
      expect((await god.api.god.users({ userId: alice.id }).get()).status).toBe(404);
      expect((await god.api.god.users.get({ query: ALL })).data?.total).toBe(1);
    });

    it('removes an account whose projects still have another owner', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });
      const bob = await addUser({ email: 'bob@example.com' });
      await alice.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await joinProject(alice, bob, 'MKT', 'owner');

      const res = await god.api.god.users({ userId: alice.id }).delete();

      expect(res.status).toBe(204);
      // MKT survives with Bob as its remaining owner.
      const remaining = await god.api.god.users({ userId: bob.id }).get();
      expect(remaining.data?.projects).toHaveLength(1);
      expect(remaining.data?.projects[0]).toMatchObject({ projectKey: 'MKT', ownerCount: 1 });
    });

    it('refuses to delete the instance owner', async () => {
      const { god } = await setup();

      const res = await god.api.god.users({ userId: god.id }).delete();

      expect(res.status).toBe(403);
      expect((await god.api.god.users({ userId: god.id }).get()).status).toBe(200);
    });

    it("refuses to delete an agent's bot user", async () => {
      const { god } = await setup();
      await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
      const agentUserId = await createAgentUser(god, 'MKT');

      const res = await god.api.god.users({ userId: agentUserId }).delete();

      expect(res.status).toBe(400);
      expect((await god.api.god.users({ userId: agentUserId }).get()).status).toBe(200);
    });

    it('refuses when the account is the only owner of a project', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });
      const bob = await addUser({ email: 'bob@example.com' });
      await alice.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await joinProject(alice, bob, 'MKT', 'member');

      const res = await god.api.god.users({ userId: alice.id }).delete();

      expect(res.status).toBe(400);
      // The message names the projects standing in the way.
      expect(JSON.stringify(res.error?.value)).toContain('MKT');
      // Neither the account nor the project was touched.
      expect((await god.api.god.users({ userId: alice.id }).get()).status).toBe(200);
      expect((await god.api.god.users({ userId: bob.id }).get()).data?.projects).toHaveLength(1);
    });

    it('deletes the sole-owned projects with the account when asked', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });
      const bob = await addUser({ email: 'bob@example.com' });
      await alice.api.projects.post({ key: 'MKT', name: 'Marketing' });
      await joinProject(alice, bob, 'MKT', 'member');

      const res = await god.api.god
        .users({ userId: alice.id })
        .delete(undefined, { query: { withProjects: true } });

      expect(res.status).toBe(204);
      expect((await god.api.god.users({ userId: alice.id }).get()).status).toBe(404);
      // MKT went with the account, so Bob's membership went with it.
      const remaining = await god.api.god.users({ userId: bob.id }).get();
      expect(remaining.data?.projects).toEqual([]);
      expect(remaining.data?.projectCount).toBe(0);
    });

    it('leaves projects the account only shares alone', async () => {
      const { god } = await setup();
      const alice = await addUser({ email: 'alice@example.com' });
      const bob = await addUser({ email: 'bob@example.com' });
      // Bob owns OPS; Alice is only a member there, so it is not hers to take down.
      await bob.api.projects.post({ key: 'OPS', name: 'Operations' });
      await joinProject(bob, alice, 'OPS', 'member');

      const res = await god.api.god
        .users({ userId: alice.id })
        .delete(undefined, { query: { withProjects: true } });

      expect(res.status).toBe(204);
      const remaining = await god.api.god.users({ userId: bob.id }).get();
      expect(remaining.data?.projects).toHaveLength(1);
      expect(remaining.data?.projects[0]).toMatchObject({ projectKey: 'OPS' });
    });

    it('404s for an unknown id', async () => {
      const { god } = await setup();

      const res = await god.api.god.users({ userId: 'no-such-user' }).delete();

      expect(res.status).toBe(404);
    });
  });
});
