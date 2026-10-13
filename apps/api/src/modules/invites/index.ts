import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser, type AuthUser } from '#shared/access';
import { inviteValidSince } from '@repo/auth';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getRole } from '#modules/roles/service';
import { teamParams } from '#modules/teams/model';
import {
  AcceptInviteResponse,
  InviteCreateResponse,
  InviteEmailResponse,
  InviteRowListResponse,
  InviteRowResponse,
  InviteViewResponse,
  createInviteBody,
  createTeamInviteBody,
  inviteParams,
  teamInviteParams,
  tokenParams,
} from './model';
import {
  createInvite,
  mayGrantInviteRanks,
  listProjectInvites,
  listTeamInvites,
  deleteProjectInvite,
  deleteTeamInvite,
  getInviteById,
  getInviteByToken,
  getInviteRowByToken,
  getInviteGrant,
  renewInvite,
  acceptInvite,
  rejectInvite,
  type InviteRow,
} from './service';
import { enqueueInviteEmail, type InviteProject } from './email';

// Shared by accept and reject: an invite is actionable only by the account whose
// email it names, and only while it is still pending.
async function loadActionableInvite(token: string, user: AuthUser | undefined | null) {
  const current = requireUser(user);
  const invite = await getInviteRowByToken(token);
  if (!invite) throw new HttpError(404, 'Invite not found');
  if (invite.status !== 'pending') throw new HttpError(409, 'This invite is no longer pending');
  const since = await inviteValidSince();
  if (since && invite.createdAt < since) throw new HttpError(409, 'This invite has expired');
  if ((current.email ?? '').toLowerCase() !== invite.email) {
    throw new HttpError(403, 'This invite was sent to a different email');
  }
  return { invite, current };
}

// The ranks are checked again here, against the sender's standing now: a link that
// grants project or team ownership must not outlive the standing that issued it, and
// the sender can be demoted or gone between the two.
async function assertStillGrantable(invite: {
  teamId: number;
  projectId: number | null;
  teamRole: string;
  projectRole: string | null;
  invitedByUserId: string | null;
}): Promise<void> {
  if (!(await mayGrantInviteRanks(invite, invite.invitedByUserId))) {
    throw new HttpError(
      409,
      'Whoever sent this invite can no longer grant the rank it carries. Ask for a new one.',
    );
  }
}

// Creating or renewing the invite link is the primary operation. A transient outbox
// failure must not discard a valid link that can still be copied.
async function queueEmail(project: InviteProject, invite: InviteRow): Promise<boolean> {
  try {
    return await enqueueInviteEmail(project, invite);
  } catch (err) {
    console.error('[invites] email enqueue failed:', err);
    return false;
  }
}

export const inviteRoutes = new Elysia({ name: 'invites', detail: { tags: ['Invites'] } })
  .use(authContext)
  .use(guards)

  .post(
    '/projects/:projectKey/invites',
    async ({ project, body, user, set }) => {
      // Ownership is not one of the ranks the member permission carries: an owner
      // bypasses the role matrix, so only a project owner or someone who runs the team
      // hands it out — an invite is the third way to make one, beside members/.
      const invitedBy = requireUser(user).id;
      if (
        !(await mayGrantInviteRanks(
          {
            teamId: project.teamId,
            projectId: project.id,
            teamRole: 'member',
            projectRole: body.role,
          },
          invitedBy,
        ))
      ) {
        throw new HttpError(
          403,
          'Only a project owner or a team owner or manager can invite an owner',
        );
      }
      // For a member invite, an explicit roleId must name a role of this project's
      // team; null (or omitted) falls back to the team's default role on accept. An
      // owner invite ignores roleId (owners bypass roles).
      const roleId = body.role === 'member' ? (body.roleId ?? null) : null;
      if (roleId != null) {
        const role = await getRole(project.teamId, roleId);
        if (!role) throw new HttpError(400, "roleId does not belong to this project's team");
      }
      const invite = await createInvite({
        teamId: project.teamId,
        projectId: project.id,
        email: body.email,
        // An invite into a project brings its invitee into the team as a plain
        // member; the rank above that is granted by an invite into the team itself.
        teamRole: 'member',
        projectRole: body.role,
        roleId,
        invitedByUserId: invitedBy,
      });
      const emailQueued = await queueEmail(project, invite);
      set.status = 201;
      return { ...invite, emailQueued };
    },
    {
      body: createInviteBody,
      memberAdmin: ['members_invite', 'create'],
      response: { 201: InviteCreateResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Create an invite',
        description:
          'Create an invite link for an email and role (owner or member). For a member, roleId ' +
          "picks the custom role, or null for the default role. Accepting it joins the project's " +
          'team as well. Queues an email when the instance email provider is configured.',
        ...mcpTool('create_invite'),
      },
    },
  )

  .post(
    '/projects/:projectKey/invites/:inviteId/email',
    async ({ project, params }) => {
      const invite = await getInviteById(params.inviteId);
      if (!invite || invite.projectKey !== project.key) {
        throw new HttpError(404, 'Invite not found');
      }
      if (invite.status !== 'pending') {
        throw new HttpError(409, 'This invite is no longer pending');
      }
      // Mailing a dead link only leads the invitee to an error; renewing sends a live one.
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        throw new HttpError(409, 'This invite has expired. Renew it to send a new link.');
      }
      return { emailQueued: await enqueueInviteEmail(project, invite) };
    },
    {
      params: inviteParams,
      memberAdmin: ['members_invite', 'create'],
      response: { 200: InviteEmailResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Send an invite email',
        description:
          'Queue an email for a pending project invite. Returns false when the instance email ' +
          'provider is not configured. An expired invite is refused: renew it instead.',
        ...mcpTool('send_invite_email'),
      },
    },
  )

  .post(
    '/projects/:projectKey/invites/:inviteId/renew',
    async ({ project, params, user, set }) => {
      const renewedBy = requireUser(user).id;
      const grant = await getInviteGrant(params.inviteId);
      if (!grant || grant.projectId !== project.id) throw new HttpError(404, 'Invite not found');
      // Renewing hands the grant out again, so it is held to the same rules as creating it.
      if (!(await mayGrantInviteRanks(grant, renewedBy))) {
        throw new HttpError(
          403,
          'Only a project owner or a team owner or manager can invite an owner',
        );
      }
      const invite = await renewInvite(grant, renewedBy);
      const emailQueued = await queueEmail(project, invite);
      set.status = 201;
      return { ...invite, emailQueued };
    },
    {
      params: inviteParams,
      memberAdmin: ['members_invite', 'create'],
      response: { 201: InviteCreateResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Renew an expired invite',
        description:
          'Replace an expired project invite with a new one for the same email and role: a new ' +
          'link, valid again for the instance invite lifetime. Emails it when the instance ' +
          'email provider is configured. An invite that has not expired is refused.',
        ...mcpTool('renew_invite'),
      },
    },
  )

  .get(
    '/projects/:projectKey/invites',
    async ({ project }) => {
      return listProjectInvites(project.id);
    },
    {
      memberAdmin: ['members_invite', 'read'],
      response: { 200: InviteRowListResponse, ...accessErrors },
      detail: { summary: "List a project's invites", ...mcpTool('list_invites') },
    },
  )

  .delete(
    '/projects/:projectKey/invites/:inviteId',
    async ({ project, params }) => {
      const removed = await deleteProjectInvite(project.id, params.inviteId);
      if (!removed) throw new HttpError(404, 'Invite not found');
      return noContent();
    },
    {
      params: inviteParams,
      memberAdmin: ['members_invite', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an invite',
        description: 'Revoke a project invite.',
        ...mcpTool('delete_invite'),
      },
    },
  )

  // Team invites carry no project: the invitee joins the team alone, and reaches its
  // projects through a membership added afterwards.
  .post(
    '/teams/:teamId/invites',
    async ({ membership, body, set }) => {
      if (
        !(await mayGrantInviteRanks(
          { teamId: membership.teamId, projectId: null, teamRole: body.role, projectRole: null },
          membership.userId,
        ))
      ) {
        throw new HttpError(403, 'Only a team owner can invite an owner or a manager');
      }
      const invite = await createInvite({
        teamId: membership.teamId,
        projectId: null,
        email: body.email,
        teamRole: body.role,
        projectRole: null,
        roleId: null,
        invitedByUserId: membership.userId,
      });
      set.status = 201;
      return invite;
    },
    {
      teamManager: true,
      params: teamParams,
      body: createTeamInviteBody,
      response: { 201: InviteRowResponse, ...errors(400, 401, 403, 404, 409) },
      detail: {
        summary: 'Invite someone to a team',
        description:
          'Create an invite link into the team, as a member, a manager or an owner. Only an ' +
          'owner can invite a manager or another owner.',
      },
    },
  )

  .get(
    '/teams/:teamId/invites',
    async ({ membership }) => {
      return listTeamInvites(membership.teamId);
    },
    {
      teamManager: true,
      params: teamParams,
      response: { 200: InviteRowListResponse, ...errors(401, 403, 404) },
      detail: {
        summary: "List a team's invites",
        description:
          'Every invite into the team, including the ones that also name one of its projects.',
      },
    },
  )

  // The team list also shows the invites that name one of its projects, so this renews
  // those too, queueing their email as their project would. A team invite has no email.
  .post(
    '/teams/:teamId/invites/:inviteId/renew',
    async ({ membership, params, set }) => {
      const grant = await getInviteGrant(params.inviteId);
      if (!grant || grant.teamId !== membership.teamId) {
        throw new HttpError(404, 'Invite not found');
      }
      if (!(await mayGrantInviteRanks(grant, membership.userId))) {
        throw new HttpError(403, 'Only a team owner can invite an owner or a manager');
      }
      const invite = await renewInvite(grant, membership.userId);
      const { projectId } = grant;
      const projectName = invite.projectName;
      const emailQueued =
        projectId != null && projectName != null
          ? await queueEmail({ id: projectId, name: projectName }, invite)
          : false;
      set.status = 201;
      return { ...invite, emailQueued };
    },
    {
      teamManager: true,
      params: teamInviteParams,
      response: { 201: InviteCreateResponse, ...errors(401, 403, 404, 409) },
      detail: {
        summary: 'Renew an expired invite of the team',
        description:
          'Replace an expired invite into the team, or into one of its projects, with a new one ' +
          'for the same email and rank: a new link, valid again for the instance invite ' +
          'lifetime. Queues the email of a project invite when the instance email provider is ' +
          'configured; a team invite returns its link to share.',
      },
    },
  )

  .delete(
    '/teams/:teamId/invites/:inviteId',
    async ({ membership, params }) => {
      const removed = await deleteTeamInvite(membership.teamId, params.inviteId);
      if (!removed) throw new HttpError(404, 'Invite not found');
      return noContent();
    },
    {
      teamManager: true,
      params: teamInviteParams,
      response: { 204: t.Void(), ...errors(401, 403, 404) },
      detail: {
        summary: 'Delete an invite of the team',
        description: 'Revoke an invite into the team or into one of its projects.',
      },
    },
  )

  // Unguarded by membership: the invitee is not a member yet. The token is
  // unguessable, so any authenticated caller holding one may read the invite.
  .get(
    '/invites/:token',
    async ({ params }) => {
      const invite = await getInviteByToken(params.token);
      if (!invite) throw new HttpError(404, 'Invite not found');
      return invite;
    },
    {
      params: tokenParams,
      response: { 200: InviteViewResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Get an invite',
        description: 'Get an invite by its token, with its team, project and role.',
        ...mcpTool('get_invite'),
      },
    },
  )

  .post(
    '/invites/:token/accept',
    async ({ params, user }) => {
      const { invite, current } = await loadActionableInvite(params.token, user);
      await assertStillGrantable(invite);
      return acceptInvite(invite, current.id);
    },
    {
      params: tokenParams,
      response: { 200: AcceptInviteResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Accept an invite',
        description:
          'Accept an invite (email must match your session). An invite into a project you are ' +
          'already a member of is refused: accepting it would rewrite the membership you hold.',
        ...mcpTool('accept_invite'),
      },
    },
  )

  .post(
    '/invites/:token/reject',
    async ({ params, user }) => {
      const { invite } = await loadActionableInvite(params.token, user);
      await rejectInvite(invite.id);
      return noContent();
    },
    {
      params: tokenParams,
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Reject an invite',
        description: 'Reject an invite (email must match your session).',
        // Rejecting consumes the invite; it has to be issued again to rejoin.
        ...mcpTool('reject_invite', { destructiveHint: true }),
      },
    },
  );
