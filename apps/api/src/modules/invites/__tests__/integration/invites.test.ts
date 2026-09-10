import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser, type TestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';
import { clearLimits, setLimits } from '#tests/helpers/limits';

// Integration coverage for the invites feature: the routes that create/list/revoke
// invites into a project and into a team, and the invitee-side routes that read,
// accept, or reject a token. Real sessions against the real (test) database. See
// apps/api/AGENTS.md "Tests" for setup.

// Creates a project MKT owned by a fresh user and returns a Treaty client acting
// as that owner. The first user in a reset DB is "god"; the owner still reaches
// the project only through its project_member row, so this is a plain owner.
async function setupOwner(): Promise<{
  user: TestUser;
  api: ReturnType<typeof authedApi>;
  projectId: number;
}> {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const project = await api.projects.post({ key: 'MKT', name: 'Marketing' });
  return { user, api, projectId: project.data!.id };
}

async function configureEmail(owner: ReturnType<typeof authedApi>) {
  const result = await owner.god['email-settings'].put({
    from: "It's a Plan <noreply@example.com>",
    resend: { enabled: true, apiKey: 're_test_key' },
    allowProjects: false,
  });
  expect(result.status).toBe(200);
}

async function deliverInvite(projectId: number, projectInviteId: number) {
  const token = 'invite-email-test-worker-token';
  const previousToken = process.env.WORKER_INTERNAL_TOKEN;
  process.env.WORKER_INTERNAL_TOKEN = token;
  let response: Response;
  try {
    response = await app.handle(
      new Request('http://localhost/internal/notification-deliveries/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-worker-token': token },
        body: JSON.stringify({
          projectId,
          channel: 'email',
          recipient: 'invitee@example.com',
          payload: { text: 'Invitation', projectInviteId },
        }),
      }),
    );
  } finally {
    if (previousToken == null) delete process.env.WORKER_INTERNAL_TOKEN;
    else process.env.WORKER_INTERNAL_TOKEN = previousToken;
  }
  return { status: response.status, body: await response.json() };
}

// The id of the team the caller owns — every account is given one at registration.
async function ownTeamId(api: ReturnType<typeof authedApi>): Promise<number> {
  const teams = await api.teams.get();
  return teams.data!.find((one) => one.role === 'owner')!.id;
}

// Signs up a user, invites them into the given team on the given rank and accepts on
// their behalf. Returns a client acting as that member.
async function addTeamMember(
  owner: { api: ReturnType<typeof authedApi> },
  teamId: number,
  role: 'owner' | 'manager' | 'member',
) {
  const user = await signUpTestUser();
  const created = await owner.api.teams({ teamId }).invites.post({ email: user.email, role });
  const api = authedApi(user.cookie);
  await api.invites({ token: created.data!.token }).accept.post();
  return { user, api };
}

describe('invites', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(clearLimits);

  describe('create — POST /projects/:projectKey/invites', () => {
    it('creates a pending invite and returns its token and inviter', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'invitee@example.com', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        email: 'invitee@example.com',
        role: 'member',
        status: 'pending',
        emailQueued: false,
        respondedAt: null,
        invitedByEmail: owner.user.email,
      });
      expect(typeof res.data?.token).toBe('string');
      expect(res.data?.token.length).toBeGreaterThan(0);
    });

    it('queues an email from the instance provider without project opt-in', async () => {
      const owner = await setupOwner();
      await configureEmail(owner.api);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'invitee@example.com', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.data?.emailQueued).toBe(true);
    });

    it('normalizes the email to lowercase', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'Mixed.Case@Example.COM', role: 'owner' });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ email: 'mixed.case@example.com', role: 'owner' });
    });

    it('rejects a malformed email with 400', async () => {
      const owner = await setupOwner();
      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'not-an-email', role: 'member' });
      expect(res.status).toBe(400);
    });

    it('rejects a second pending invite for the same email with 409', async () => {
      const owner = await setupOwner();
      const body = { email: 'dup@example.com', role: 'member' as const };

      const first = await owner.api.projects({ projectKey: 'MKT' }).invites.post(body);
      expect(first.status).toBe(201);

      const second = await owner.api.projects({ projectKey: 'MKT' }).invites.post(body);
      expect(second.status).toBe(409);
    });

    it('rejects an invalid role with 400', async () => {
      const owner = await setupOwner();
      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        // @ts-expect-error — role must be "owner" | "member"
        .invites.post({ email: 'x@example.com', role: 'admin' });
      expect(res.status).toBe(400);
    });

    it('pins a custom role on a member invite', async () => {
      const owner = await setupOwner();
      const role = await createRole(owner.api, 'MKT', { name: 'Editor', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'editor@example.com', role: 'member', roleId: role.data!.id });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ role: 'member', roleId: role.data!.id, roleName: 'Editor' });
    });

    it('ignores roleId on an owner invite', async () => {
      const owner = await setupOwner();
      const role = await createRole(owner.api, 'MKT', { name: 'Editor', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'boss@example.com', role: 'owner', roleId: role.data!.id });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ role: 'owner', roleId: null, roleName: null });
    });

    it('rejects a roleId from another team with 400', async () => {
      const owner = await setupOwner();
      // Every project of a team shares its roles, so only a role of another team is
      // out of reach here.
      const stranger = authedApi((await signUpTestUser()).cookie);
      await stranger.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = await createRole(stranger, 'OPS', { name: 'Ops', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'x@example.com', role: 'member', roleId: foreign.data!.id });
      expect(res.status).toBe(400);
    });

    it('denies a non-member with 403', async () => {
      await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'x@example.com', role: 'member' });
      expect(res.status).toBe(403);
    });
  });

  describe('email — POST /projects/:projectKey/invites/:inviteId/email', () => {
    it('reports that email is unavailable without blocking the invite', async () => {
      const owner = await setupOwner();
      const invite = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'invitee@example.com', role: 'member' });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: invite.data!.id })
        .email.post();

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ emailQueued: false });
    });

    it('queues a pending invite and accepts concurrent repeat requests', async () => {
      const owner = await setupOwner();
      const invite = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'invitee@example.com', role: 'member' });
      await configureEmail(owner.api);
      const client = owner.api
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: invite.data!.id }).email;

      const [first, second] = await Promise.all([client.post(), client.post()]);

      expect(first.status).toBe(200);
      expect(first.data).toEqual({ emailQueued: true });
      expect(second.status).toBe(200);
      expect(second.data).toEqual({ emailQueued: true });
    });

    it('returns 404 for an unknown invite id', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: 999999 })
        .email.post();

      expect(res.status).toBe(404);
    });

    it('returns 409 after an invite was accepted', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const invite = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });
      await authedApi(invitee.cookie).invites({ token: invite.data!.token }).accept.post();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: invite.data!.id })
        .email.post();

      expect(res.status).toBe(409);
    });

    it('drops a queued delivery after the invite was accepted', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const invite = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });
      await authedApi(invitee.cookie).invites({ token: invite.data!.token }).accept.post();

      const result = await deliverInvite(owner.projectId, invite.data!.id);

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ ok: true });
    });

    it('denies a non-member', async () => {
      const owner = await setupOwner();
      const invite = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'invitee@example.com', role: 'member' });
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: invite.data!.id })
        .email.post();

      expect(res.status).toBe(403);
    });
  });

  describe('list — GET /projects/:projectKey/invites', () => {
    it("lists the project's invites, newest first", async () => {
      const owner = await setupOwner();
      await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'a@example.com', role: 'member' });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'b@example.com', role: 'owner' });

      const res = await owner.api.projects({ projectKey: 'MKT' }).invites.get();
      expect(res.status).toBe(200);
      expect(res.data?.map((i) => i.email)).toEqual(['b@example.com', 'a@example.com']);
    });

    it('denies a non-member with 403', async () => {
      await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider.projects({ projectKey: 'MKT' }).invites.get();
      expect(res.status).toBe(403);
    });
  });

  describe('revoke — DELETE /projects/:projectKey/invites/:inviteId', () => {
    it('removes a pending invite', async () => {
      const owner = await setupOwner();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'gone@example.com', role: 'member' });

      const del = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: created.data!.id })
        .delete();
      expect(del.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).invites.get();
      expect(list.data).toHaveLength(0);
    });

    it('returns 404 for an unknown invite id', async () => {
      const owner = await setupOwner();
      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: 999999 })
        .delete();
      expect(res.status).toBe(404);
    });

    it('returns 400 for a non-numeric invite id', async () => {
      const owner = await setupOwner();
      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: 'abc' })
        .delete();
      expect(res.status).toBe(400);
    });

    it('denies a non-member with 403', async () => {
      const owner = await setupOwner();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'x@example.com', role: 'member' });
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider
        .projects({ projectKey: 'MKT' })
        .invites({ inviteId: created.data!.id })
        .delete();
      expect(res.status).toBe(403);
    });
  });

  describe('read by token — GET /invites/:token', () => {
    it('returns the invite with project context and hasAccount=false for a stranger email', async () => {
      const owner = await setupOwner();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'nobody@example.com', role: 'member' });

      const res = await authedApi((await signUpTestUser()).cookie)
        .invites({ token: created.data!.token })
        .get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        projectKey: 'MKT',
        projectName: 'Marketing',
        email: 'nobody@example.com',
        role: 'member',
        status: 'pending',
        hasAccount: false,
      });
    });

    it('reports hasAccount=true when the invited email already has an account', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });

      const res = await authedApi(invitee.cookie).invites({ token: created.data!.token }).get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ hasAccount: true });
    });

    it('returns 404 for an unknown token', async () => {
      const owner = await setupOwner();
      const res = await owner.api.invites({ token: '00000000-0000-0000-0000-000000000000' }).get();
      expect(res.status).toBe(404);
    });

    it('returns 400 for a malformed (non-UUID) token', async () => {
      const owner = await setupOwner();
      const res = await owner.api.invites({ token: 'not-a-uuid' }).get();
      expect(res.status).toBe(400);
    });
  });

  describe('accept — POST /invites/:token/accept', () => {
    it('adds the invitee as a member and marks the invite accepted', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });
      const inviteeApi = authedApi(invitee.cookie);

      // Before accepting, the invitee cannot reach the project.
      const before = await inviteeApi.projects({ projectKey: 'MKT' }).get();
      expect(before.status).toBe(403);

      const accept = await inviteeApi.invites({ token: created.data!.token }).accept.post();
      expect(accept.status).toBe(200);
      expect(accept.data).toMatchObject({
        projectKey: 'MKT',
        projectName: 'Marketing',
        role: 'member',
      });

      // Membership took effect: the invitee can now read the project.
      const after = await inviteeApi.projects({ projectKey: 'MKT' }).get();
      expect(after.status).toBe(200);

      // The invite is no longer pending.
      const view = await inviteeApi.invites({ token: created.data!.token }).get();
      expect(view.data).toMatchObject({ status: 'accepted' });
    });

    it('refuses the accept once the team has no seat left', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });
      const inviteeApi = authedApi(invitee.cookie);
      // The owner alone already fills the team.
      setLimits({ maxTeamMembers: 1 });

      const accept = await inviteeApi.invites({ token: created.data!.token }).accept.post();
      expect(accept.status).toBe(409);
      expect((await inviteeApi.projects({ projectKey: 'MKT' }).get()).status).toBe(403);

      // The invite is still pending, so it works again once there is room.
      clearLimits();
      expect((await inviteeApi.invites({ token: created.data!.token }).accept.post()).status).toBe(
        200,
      );
    });

    it("joins the invitee on the invite's pinned custom role", async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const role = await createRole(owner.api, 'MKT', { name: 'Editor', permissions: {} });
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member', roleId: role.data!.id });

      const accept = await authedApi(invitee.cookie)
        .invites({ token: created.data!.token })
        .accept.post();
      expect(accept.status).toBe(200);

      const members = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = members.data?.items.find((m) => m.userId === invitee.userId);
      expect(row).toMatchObject({ role: 'member', roleId: role.data!.id, roleName: 'Editor' });
    });

    it('matches the session email case-insensitively', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email.toUpperCase(), role: 'member' });

      const accept = await authedApi(invitee.cookie)
        .invites({ token: created.data!.token })
        .accept.post();
      expect(accept.status).toBe(200);
    });

    it('denies acceptance from a different email with 403', async () => {
      const owner = await setupOwner();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'someone-else@example.com', role: 'member' });

      const other = authedApi((await signUpTestUser()).cookie);
      const res = await other.invites({ token: created.data!.token }).accept.post();
      expect(res.status).toBe(403);
    });

    it('returns 409 when the invite is no longer pending', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });
      const inviteeApi = authedApi(invitee.cookie);

      await inviteeApi.invites({ token: created.data!.token }).accept.post();
      const again = await inviteeApi.invites({ token: created.data!.token }).accept.post();
      expect(again.status).toBe(409);
    });

    it('returns 404 for an unknown token', async () => {
      const invitee = authedApi((await signUpTestUser()).cookie);
      const res = await invitee
        .invites({ token: '00000000-0000-0000-0000-000000000000' })
        .accept.post();
      expect(res.status).toBe(404);
    });

    // A project invite is refused for an address already in the project, but the
    // invitee can join it between the invite and the accept: through a team invite,
    // and then from the project's member list. Accepting the older link afterwards
    // would write the invite's role over the membership they hold — an owner would
    // be demoted past the last-owner check, leaving the project with none.
    it('refuses a project invite the invitee already holds a membership for', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const inviteeApi = authedApi(invitee.cookie);
      const projectInvite = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });

      // They join the team by another invite, and the project as an owner from its
      // member list, while the project invite above is still pending.
      const teamId = await ownTeamId(owner.api);
      const teamInvite = await owner.api
        .teams({ teamId })
        .invites.post({ email: invitee.email, role: 'member' });
      await inviteeApi.invites({ token: teamInvite.data!.token }).accept.post();
      const added = await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: invitee.userId, role: 'owner' });
      expect(added.status).toBe(204);

      const accept = await inviteeApi.invites({ token: projectInvite.data!.token }).accept.post();
      expect(accept.status).toBe(409);
      expect(accept.error?.value).toMatchObject({ code: 'ALREADY_PROJECT_MEMBER' });

      // The membership they held is untouched, so the project keeps its owners.
      const members = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(members.data?.items.find((m) => m.userId === invitee.userId)).toMatchObject({
        role: 'owner',
      });
      expect(members.data?.ownerCount).toBe(2);
    });
  });

  describe('reject — POST /invites/:token/reject', () => {
    it('marks the invite rejected without creating a membership', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });
      const inviteeApi = authedApi(invitee.cookie);

      const res = await inviteeApi.invites({ token: created.data!.token }).reject.post();
      expect(res.status).toBe(204);

      // No membership was created.
      const project = await inviteeApi.projects({ projectKey: 'MKT' }).get();
      expect(project.status).toBe(403);

      // The invite is now rejected.
      const view = await inviteeApi.invites({ token: created.data!.token }).get();
      expect(view.data).toMatchObject({ status: 'rejected' });
    });

    it('denies rejection from a different email with 403', async () => {
      const owner = await setupOwner();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'someone-else@example.com', role: 'member' });

      const other = authedApi((await signUpTestUser()).cookie);
      const res = await other.invites({ token: created.data!.token }).reject.post();
      expect(res.status).toBe(403);
    });

    it('returns 409 when the invite is no longer pending', async () => {
      const owner = await setupOwner();
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'member' });
      const inviteeApi = authedApi(invitee.cookie);

      await inviteeApi.invites({ token: created.data!.token }).reject.post();
      const again = await inviteeApi.invites({ token: created.data!.token }).reject.post();
      expect(again.status).toBe(409);
    });

    it('returns 404 for an unknown token', async () => {
      const invitee = authedApi((await signUpTestUser()).cookie);
      const res = await invitee
        .invites({ token: '00000000-0000-0000-0000-000000000000' })
        .reject.post();
      expect(res.status).toBe(404);
    });
  });

  describe("a project invite and the project's team", () => {
    it("puts the invitee in the project's team as a plain member", async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const invitee = await signUpTestUser();
      const created = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'owner' });
      const inviteeApi = authedApi(invitee.cookie);

      await inviteeApi.invites({ token: created.data!.token }).accept.post();

      const teams = await inviteeApi.teams.get();
      expect(teams.data?.find((one) => one.id === teamId)).toMatchObject({ role: 'member' });
    });

    it('refuses a project invite for someone already in the team with 409', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const manager = await addTeamMember(owner, teamId, 'manager');

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: manager.user.email, role: 'member' });

      expect(res.status).toBe(409);
    });

    // Accepting one would rewrite the membership they hold, which is how a project's
    // last owner would be demoted past the last-owner check in members/.
    it('refuses a project invite for someone already in the project with 409', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: owner.user.email, role: 'member' });

      expect(res.status).toBe(409);
    });

    it('lets a team manager who is not in the project invite into it', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const manager = await addTeamMember(owner, teamId, 'manager');

      const res = await manager.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'outsider@example.com', role: 'member' });
      expect(res.status).toBe(201);
    });

    it('denies a plain team member who is not in the project with 403', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const member = await addTeamMember(owner, teamId, 'member');

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'outsider@example.com', role: 'member' });
      expect(res.status).toBe(403);
    });
  });

  describe('team invites — /teams/:teamId/invites', () => {
    it('creates an invite into the team alone', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);

      const res = await owner.api
        .teams({ teamId })
        .invites.post({ email: 'joiner@example.com', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        email: 'joiner@example.com',
        teamRole: 'member',
        projectKey: null,
        role: null,
        status: 'pending',
        invitedByEmail: owner.user.email,
      });
    });

    it('joins the team and no project when accepted', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const invitee = await signUpTestUser();
      const created = await owner.api
        .teams({ teamId })
        .invites.post({ email: invitee.email, role: 'member' });
      const inviteeApi = authedApi(invitee.cookie);

      const accept = await inviteeApi.invites({ token: created.data!.token }).accept.post();
      expect(accept.status).toBe(200);
      expect(accept.data).toMatchObject({ projectKey: null, projectName: null, role: null });

      const teams = await inviteeApi.teams.get();
      expect(teams.data?.find((one) => one.id === teamId)).toMatchObject({ role: 'member' });
      const project = await inviteeApi.projects({ projectKey: 'MKT' }).get();
      expect(project.status).toBe(403);
    });

    it('rejects a second pending invite for the same email with 409', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const body = { email: 'dup@example.com', role: 'member' as const };

      expect((await owner.api.teams({ teamId }).invites.post(body)).status).toBe(201);
      expect((await owner.api.teams({ teamId }).invites.post(body)).status).toBe(409);
    });

    it('refuses an invite for someone already in the team with 409', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const member = await addTeamMember(owner, teamId, 'member');

      const res = await owner.api
        .teams({ teamId })
        .invites.post({ email: member.user.email, role: 'manager' });

      expect(res.status).toBe(409);
    });

    it('lists the invites into the team and into its projects, newest first', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'in-project@example.com', role: 'member' });
      await owner.api
        .teams({ teamId })
        .invites.post({ email: 'in-team@example.com', role: 'member' });

      const res = await owner.api.teams({ teamId }).invites.get();
      expect(res.status).toBe(200);
      expect(res.data?.map((i) => [i.email, i.projectKey])).toEqual([
        ['in-team@example.com', null],
        ['in-project@example.com', 'MKT'],
      ]);
    });

    it('revokes an invite of the team', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const created = await owner.api
        .teams({ teamId })
        .invites.post({ email: 'gone@example.com', role: 'member' });

      const del = await owner.api
        .teams({ teamId })
        .invites({ inviteId: created.data!.id })
        .delete();
      expect(del.status).toBe(204);
      expect((await owner.api.teams({ teamId }).invites.get()).data).toHaveLength(0);
    });

    it('returns 404 revoking an invite of another team', async () => {
      const owner = await setupOwner();
      const stranger = authedApi((await signUpTestUser()).cookie);
      const strangerTeamId = await ownTeamId(stranger);
      const created = await stranger
        .teams({ teamId: strangerTeamId })
        .invites.post({ email: 'x@example.com', role: 'member' });

      const res = await owner.api
        .teams({ teamId: await ownTeamId(owner.api) })
        .invites({ inviteId: created.data!.id })
        .delete();
      expect(res.status).toBe(404);
    });

    it('lets an owner invite a manager', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);

      const res = await owner.api
        .teams({ teamId })
        .invites.post({ email: 'boss@example.com', role: 'manager' });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ teamRole: 'manager' });
    });

    it('denies a manager inviting another manager with 403', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const manager = await addTeamMember(owner, teamId, 'manager');

      const asManager = await manager.api
        .teams({ teamId })
        .invites.post({ email: 'other@example.com', role: 'manager' });
      expect(asManager.status).toBe(403);

      const asMember = await manager.api
        .teams({ teamId })
        .invites.post({ email: 'other@example.com', role: 'member' });
      expect(asMember.status).toBe(201);
    });

    it('denies a plain team member with 403', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const member = await addTeamMember(owner, teamId, 'member');

      const res = await member.api
        .teams({ teamId })
        .invites.post({ email: 'x@example.com', role: 'member' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for a team the caller is not in', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.teams({ teamId }).invites.get();
      expect(res.status).toBe(404);
    });

    it('rejects an invalid rank with 400', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const res = await owner.api
        .teams({ teamId })
        // @ts-expect-error — the rank must be "owner" | "manager" | "member"
        .invites.post({ email: 'x@example.com', role: 'agent' });
      expect(res.status).toBe(400);
    });

    it('lets an owner invite another owner', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const invitee = await signUpTestUser();

      const created = await owner.api
        .teams({ teamId })
        .invites.post({ email: invitee.email, role: 'owner' });
      expect(created.status).toBe(201);

      const inviteeApi = authedApi(invitee.cookie);
      expect((await inviteeApi.invites({ token: created.data!.token }).accept.post()).status).toBe(
        200,
      );
      const teams = await inviteeApi.teams.get();
      expect(teams.data!.find((one) => one.id === teamId)).toMatchObject({ role: 'owner' });
    });

    it('refuses an owner invite from a manager', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const manager = await addTeamMember(owner, teamId, 'manager');

      const res = await manager.api
        .teams({ teamId })
        .invites.post({ email: 'x@example.com', role: 'owner' });
      expect(res.status).toBe(403);
    });
  });

  // An owner bypasses the role matrix, so the rank is not the member permission's to
  // hand out — on either side of the invite, since the sender can lose the standing
  // before the link is opened.
  describe('granting ownership', () => {
    it('refuses an owner invite from a member who may only invite', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const inviter = await addTeamMember(owner, teamId, 'member');
      const role = await createRole(owner.api, 'MKT', {
        name: 'Recruiter',
        permissions: { members_invite: { create: true, read: true } },
      });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: inviter.user.userId, role: 'member', roleId: role.data!.id });

      const refused = await inviter.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'x@example.com', role: 'owner' });
      expect(refused.status).toBe(403);

      // The same caller may still invite a plain member.
      const allowed = await inviter.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: 'x@example.com', role: 'member' });
      expect(allowed.status).toBe(201);
    });

    it('refuses an owner invite whose sender lost the standing before it was accepted', async () => {
      const owner = await setupOwner();
      const teamId = await ownTeamId(owner.api);
      const manager = await addTeamMember(owner, teamId, 'manager');
      const invitee = await signUpTestUser();

      const created = await manager.api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: invitee.email, role: 'owner' });
      expect(created.status).toBe(201);

      await owner.api.teams({ teamId }).members({ userId: manager.user.userId }).patch({
        role: 'member',
      });

      const accept = await authedApi(invitee.cookie)
        .invites({ token: created.data!.token })
        .accept.post();
      expect(accept.status).toBe(409);
    });
  });
});
