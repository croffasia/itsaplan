import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser, type AuthUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getRole } from '#modules/roles/service';
import {
  AcceptInviteResponse,
  InviteCreateResponse,
  InviteEmailResponse,
  InviteRowListResponse,
  InviteViewResponse,
  createInviteBody,
  inviteParams,
  tokenParams,
} from './model';
import {
  createInvite,
  listInvites,
  deleteInvite,
  getInviteById,
  getInviteByToken,
  getInviteRowByToken,
  acceptInvite,
  rejectInvite,
} from './service';
import { enqueueInviteEmail } from './email';

// Shared by accept and reject: an invite is actionable only by the account whose
// email it names, and only while it is still pending.
async function loadActionableInvite(token: string, user: AuthUser | undefined | null) {
  const current = requireUser(user);
  const invite = await getInviteRowByToken(token);
  if (!invite) throw new HttpError(404, 'Invite not found');
  if (invite.status !== 'pending') throw new HttpError(409, 'This invite is no longer pending');
  if ((current.email ?? '').toLowerCase() !== invite.email) {
    throw new HttpError(403, 'This invite was sent to a different email');
  }
  return { invite, current };
}

export const inviteRoutes = new Elysia({ name: 'invites', detail: { tags: ['Invites'] } })
  .use(authContext)
  .use(guards)

  .post(
    '/projects/:projectKey/invites',
    async ({ project, body, user, set }) => {
      // For a member invite, an explicit roleId must name a role in this project;
      // null (or omitted) falls back to the project's default role on accept. An
      // owner invite ignores roleId (owners bypass roles).
      const roleId = body.role === 'member' ? (body.roleId ?? null) : null;
      if (roleId != null) {
        const role = await getRole(project.id, roleId);
        if (!role) throw new HttpError(400, 'roleId does not belong to this project');
      }
      const invite = await createInvite({
        projectId: project.id,
        email: body.email,
        role: body.role,
        roleId,
        invitedByUserId: requireUser(user).id,
      });
      let emailQueued = false;
      try {
        emailQueued = await enqueueInviteEmail(project, invite);
      } catch (err) {
        // Creating the invite link is the primary operation. A transient outbox
        // failure must not discard a valid link that can still be copied.
        console.error('[invites] email enqueue failed:', err);
      }
      set.status = 201;
      return { ...invite, emailQueued };
    },
    {
      body: createInviteBody,
      permission: ['members_invite', 'create'],
      response: { 201: InviteCreateResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Create an invite',
        description:
          'Create an invite link for an email and role (owner or member). For a member, roleId ' +
          'picks the custom role, or null for the default role. Queues an email when the ' +
          'instance email provider is configured.',
        ...mcpTool('create_invite'),
      },
    },
  )

  .post(
    '/projects/:projectKey/invites/:inviteId/email',
    async ({ project, params }) => {
      const invite = await getInviteById(project.id, params.inviteId);
      if (!invite) throw new HttpError(404, 'Invite not found');
      if (invite.status !== 'pending') {
        throw new HttpError(409, 'This invite is no longer pending');
      }
      return { emailQueued: await enqueueInviteEmail(project, invite) };
    },
    {
      params: inviteParams,
      permission: ['members_invite', 'create'],
      response: { 200: InviteEmailResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Send an invite email',
        description:
          'Queue an email for a pending project invite. Returns false when the instance email ' +
          'provider is not configured.',
        ...mcpTool('send_invite_email'),
      },
    },
  )

  .get(
    '/projects/:projectKey/invites',
    async ({ project }) => {
      return listInvites(project.id);
    },
    {
      permission: ['members_invite', 'read'],
      response: { 200: InviteRowListResponse, ...accessErrors },
      detail: { summary: "List a project's invites", ...mcpTool('list_invites') },
    },
  )

  .delete(
    '/projects/:projectKey/invites/:inviteId',
    async ({ project, params }) => {
      const removed = await deleteInvite(project.id, params.inviteId);
      if (!removed) throw new HttpError(404, 'Invite not found');
      return noContent();
    },
    {
      params: inviteParams,
      permission: ['members_invite', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an invite',
        description: 'Revoke a project invite.',
        ...mcpTool('delete_invite'),
      },
    },
  )

  // Unguarded by project membership: the invitee is not a member yet. The token
  // is unguessable, so any authenticated caller holding one may read the invite.
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
        description: 'Get an invite by its token, with its project and role.',
        ...mcpTool('get_invite'),
      },
    },
  )

  .post(
    '/invites/:token/accept',
    async ({ params, user }) => {
      const { invite, current } = await loadActionableInvite(params.token, user);
      return acceptInvite(invite, current.id);
    },
    {
      params: tokenParams,
      response: { 200: AcceptInviteResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Accept an invite',
        description: 'Accept an invite (email must match your session).',
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
