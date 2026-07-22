import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { assertPermission, requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import {
  listMembers,
  getMembership,
  removeMember,
  setMembership,
  setMemberDescription,
  countOwners,
} from './store';
import { getRole } from '../roles/store';

const memberParams = t.Object({ projectKey: t.String(), userId: t.String() });
const memberRole = t.Union([t.Literal('owner'), t.Literal('member')]);

// A member DTO (MemberRow from the store).
const MemberResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  image: t.Nullable(t.String()),
  role: memberRole,
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  description: t.String(),
  isAgent: t.Boolean(),
  createdAt: t.String(),
});

export const memberRoutes = new Elysia({ name: 'members', detail: { tags: ['Members'] } })
  .use(authContext)
  .use(guards)
  // Members with members_manage read may see who else is on the project.
  .get(
    '/projects/:projectKey/members',
    async ({ project }) => {
      return listMembers(project.id);
    },
    {
      params: t.Object({ projectKey: t.String() }),
      permission: ['members_manage', 'read'],
      response: {
        200: t.Array(MemberResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'List project members', ...mcpTool('list_members') },
    },
  )

  // Set a member's role. Owner only. role "owner" promotes them to owner (owners
  // bypass roles); role "member" assigns a custom role by roleId (null falls back
  // to the default role). Demoting the last owner is refused.
  .patch(
    '/projects/:projectKey/members/:userId',
    async ({ project, params, body, user }) => {
      // An owner cannot change their own role — leaving owner is done by removing
      // the membership, and it keeps the last-owner guard from being bypassed.
      if (params.userId === requireUser(user).id) {
        throw new HttpError(400, 'You cannot change your own role');
      }
      const target = await getMembership(project.id, params.userId);
      if (!target) throw new HttpError(404, 'Member not found');

      if (body.role === 'owner') {
        await setMembership(project.id, params.userId, 'owner', null);
        return noContent();
      }

      const roleId = body.roleId ?? null;
      if (roleId != null) {
        const role = await getRole(project.id, roleId);
        if (!role) throw new HttpError(400, 'roleId does not belong to this project');
      }
      // Demoting an owner to a member must keep at least one owner on the project.
      if (target === 'owner' && (await countOwners(project.id)) === 1) {
        throw new HttpError(400, 'A project must have at least one owner');
      }
      await setMembership(project.id, params.userId, 'member', roleId);
      return noContent();
    },
    {
      params: memberParams,
      body: t.Object({ role: memberRole, roleId: t.Optional(t.Nullable(t.Integer())) }),
      projectOwner: true,
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Update a member's role",
        description:
          "Set a member's role. 'owner' promotes to owner; 'member' assigns a custom role by " +
          'roleId, or null for the default. The last owner cannot be demoted.',
        ...mcpTool('set_member_role'),
      },
    },
  )

  // Set a member's project description (what they do). A member may edit their own;
  // an owner may edit anyone's. The description is shown on the members page and
  // given to agents so they can pick who to tag on an unassigned issue.
  .patch(
    '/projects/:projectKey/members/:userId/description',
    async ({ project, params, body, user }) => {
      const current = requireUser(user);
      if (params.userId !== current.id) {
        const role = await getMembership(project.id, current.id);
        if (role !== 'owner') {
          throw new HttpError(403, "Only a project owner can edit another member's description");
        }
      }
      const ok = await setMemberDescription(project.id, params.userId, body.description);
      if (!ok) throw new HttpError(404, 'Member not found');
      return noContent();
    },
    {
      params: memberParams,
      body: t.Object({ description: t.String({ maxLength: 500 }) }),
      projectMember: true,
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Set a member's description",
        description:
          'Set what a member does in the project. Up to 500 characters; empty string clears it.',
        ...mcpTool('set_member_description'),
      },
    },
  )

  // Revoke a member's access, or leave the project yourself. Removing someone
  // else requires members_manage delete (owners bypass); a member may always
  // remove themselves. The last owner cannot be removed. New members join through
  // invites, so there is no direct add here.
  .delete(
    '/projects/:projectKey/members/:userId',
    async ({ project, params, user }) => {
      const current = requireUser(user);
      const isSelf = params.userId === current.id;
      if (!isSelf) {
        await assertPermission(project.id, user, 'members_manage', 'delete');
      }
      const target = await getMembership(project.id, params.userId);
      if (!target) throw new HttpError(404, 'Member not found');
      if (target === 'owner' && (await countOwners(project.id)) === 1) {
        throw new HttpError(400, 'A project must have at least one owner');
      }
      await removeMember(project.id, params.userId);
      return noContent();
    },
    {
      params: memberParams,
      projectMember: true,
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Remove a member',
        description: 'Remove a member from the project, or leave it yourself.',
        ...mcpTool('remove_member'),
      },
    },
  );
