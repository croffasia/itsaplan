import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { requireUser, type AuthUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { getRole } from '../roles/store';
import {
  createInvite,
  listInvites,
  deleteInvite,
  getInviteByToken,
  getInviteRowByToken,
  acceptInvite,
  rejectInvite,
} from './store';

const inviteRole = t.Union([t.Literal('owner'), t.Literal('member')]);

// The token is a UUID column. Validating its format here turns a malformed token
// into a 400 instead of letting it reach Postgres and surface as a 500.
const tokenParams = t.Object({ token: t.String({ format: 'uuid' }) });

// An invite's lifecycle status.
const inviteStatus = t.Union([t.Literal('pending'), t.Literal('accepted'), t.Literal('rejected')]);

// The owner-facing invite row (InviteRow from the store).
const InviteRowResponse = t.Object({
  id: t.Number(),
  token: t.String(),
  email: t.String(),
  role: inviteRole,
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  status: inviteStatus,
  createdAt: t.String(),
  respondedAt: t.Nullable(t.String()),
  invitedByName: t.Nullable(t.String()),
  invitedByEmail: t.Nullable(t.String()),
});

// The invitee-facing invite view (InviteView from the store).
const InviteViewResponse = t.Object({
  token: t.String(),
  projectKey: t.String(),
  projectName: t.String(),
  email: t.String(),
  role: inviteRole,
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  status: inviteStatus,
  createdAt: t.String(),
  hasAccount: t.Boolean(),
});

// The result of accepting an invite: the joined project's context.
const AcceptInviteResponse = t.Object({
  projectKey: t.String(),
  projectName: t.String(),
  role: inviteRole,
});

// Loads the invite named by the token and asserts the caller may act on it: it
// must exist, still be pending, and be addressed to the session email
// (case-insensitive). Shared by accept and reject.
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

  // --- Owner-side: manage a project's invites ---

  // Create an invite link for an email + role. Owner only. A second pending
  // invite for the same email in the same project is a 409.
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
      set.status = 201;
      return invite;
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        email: t.String({ format: 'email' }),
        role: inviteRole,
        roleId: t.Optional(t.Nullable(t.Integer())),
      }),
      permission: ['members_invite', 'create'],
      response: {
        201: InviteRowResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Create an invite',
        description:
          'Create an invite link for an email and role (owner or member). For a member, roleId ' +
          'picks the custom role, or null for the default role.',
        ...mcpTool('create_invite'),
      },
    },
  )

  .get(
    '/projects/:projectKey/invites',
    async ({ project }) => {
      return listInvites(project.id);
    },
    {
      params: t.Object({ projectKey: t.String() }),
      permission: ['members_invite', 'read'],
      response: {
        200: t.Array(InviteRowResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's invites", ...mcpTool('list_invites') },
    },
  )

  // Revoke a pending invite (or remove a resolved one). Owner only.
  .delete(
    '/projects/:projectKey/invites/:inviteId',
    async ({ project, params }) => {
      const removed = await deleteInvite(project.id, params.inviteId);
      if (!removed) throw new HttpError(404, 'Invite not found');
      return noContent();
    },
    {
      params: t.Object({ projectKey: t.String(), inviteId: t.Numeric() }),
      permission: ['members_invite', 'delete'],
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete an invite',
        description: 'Revoke a project invite.',
        ...mcpTool('delete_invite'),
      },
    },
  )

  // --- Invitee-side: open, accept, or reject a link ---

  // Look up an invite by its token to render the accept/reject screen. Any
  // authenticated user may read it (the token is unguessable); only the matching
  // email may accept.
  .get(
    '/invites/:token',
    async ({ params }) => {
      const invite = await getInviteByToken(params.token);
      if (!invite) throw new HttpError(404, 'Invite not found');
      return invite;
    },
    {
      params: tokenParams,
      response: {
        200: InviteViewResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        404: ErrorResponse,
      },
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
      await acceptInvite(invite, current.id);
      const view = await getInviteByToken(params.token);
      return { projectKey: view!.projectKey, projectName: view!.projectName, role: view!.role };
    },
    {
      params: tokenParams,
      response: {
        200: AcceptInviteResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
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
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Reject an invite',
        description: 'Reject an invite (email must match your session).',
        // Rejecting consumes the invite; it has to be issued again to rejoin.
        ...mcpTool('reject_invite', { destructiveHint: true }),
      },
    },
  );
