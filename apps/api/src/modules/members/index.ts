import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { assertPermission, requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getRole } from '#modules/roles/service';
import {
  MemberListResponse,
  memberParams,
  setMemberDescriptionBody,
  setMemberRoleBody,
} from './model';
import {
  listMembers,
  getMembership,
  getMembershipSource,
  removeMember,
  setMembership,
  setMemberDescription,
  countOwners,
} from './service';

// A membership the SCIM group reconciliation owns is rewritten on every sync, so
// editing it here would be undone without trace. The identity provider is where it
// changes.
async function assertNotProvisioned(projectId: number, userId: string): Promise<void> {
  if ((await getMembershipSource(projectId, userId)) === 'scim') {
    throw new HttpError(409, 'This membership is managed by SCIM');
  }
}

export const memberRoutes = new Elysia({ name: 'members', detail: { tags: ['Members'] } })
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/members',
    async ({ project }) => {
      return listMembers(project.id);
    },
    {
      permission: ['members_manage', 'read'],
      response: { 200: MemberListResponse, ...accessErrors },
      detail: { summary: 'List project members', ...mcpTool('list_members') },
    },
  )

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
      await assertNotProvisioned(project.id, params.userId);

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
      body: setMemberRoleBody,
      projectOwner: true,
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: "Update a member's role",
        description:
          "Set a member's role. 'owner' promotes to owner; 'member' assigns a custom role by " +
          'roleId, or null for the default. The last owner cannot be demoted, and a membership ' +
          'granted by a provisioned group is managed by the identity provider.',
        ...mcpTool('set_member_role'),
      },
    },
  )

  // The description is shown on the members page and given to agents so they can
  // pick who to tag on an unassigned issue.
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
      body: setMemberDescriptionBody,
      projectMember: true,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: "Set a member's description",
        description:
          'Set what a member does in the project. Up to 500 characters; empty string clears it.',
        ...mcpTool('set_member_description'),
      },
    },
  )

  // New members join through invites, so there is no direct add here.
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
      await assertNotProvisioned(project.id, params.userId);
      if (target === 'owner' && (await countOwners(project.id)) === 1) {
        throw new HttpError(400, 'A project must have at least one owner');
      }
      await removeMember(project.id, params.userId);
      return noContent();
    },
    {
      params: memberParams,
      projectMember: true,
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Remove a member',
        description:
          'Remove a member from the project, or leave it yourself. A membership granted by a ' +
          'provisioned group is managed by the identity provider.',
        ...mcpTool('remove_member'),
      },
    },
  );
