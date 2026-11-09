import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { paginate } from '#shared/pagination';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import {
  assertProjectAdmin,
  assertGrantablePermissions,
  requireUser,
  type AuthUser,
} from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getAssignableRole, getDefaultRoleId } from '#modules/roles/service';
import { getTeamMembership } from '#modules/teams/service';
import type { ProjectRow } from '#modules/projects/service';
import { isAgentUser } from '#modules/agents/core/service';
import {
  MemberCandidateListResponse,
  MemberPageResponse,
  addMemberBody,
  memberListQuery,
  memberParams,
  setMemberDescriptionBody,
  setMemberRoleBody,
} from './model';
import {
  addMember,
  listMembersPage,
  listMemberCandidates,
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

// An owner bypasses the permission matrix, so the standing is kept for people: an
// agent works under a role, which is what caps what its key and its tools may do.
async function assertAgentNotOwner(userId: string, role: string): Promise<void> {
  if (role === 'owner' && (await isAgentUser(userId))) {
    throw new HttpError(400, 'An AI agent cannot be a project owner');
  }
}

// Who may hand out project ownership. The member permission fills the list and
// assigns the roles the team offers; ownership is not one of them, since an owner
// bypasses the matrix and could hand it back. Only an owner of the project, or an
// owner or manager of the team that owns it, grants it.
async function assertMayGrantOwner(
  project: ProjectRow,
  role: string,
  user: AuthUser | undefined | null,
): Promise<void> {
  if (role !== 'owner') return;
  await assertProjectAdmin(project, user);
}

export const memberRoutes = new Elysia({ name: 'members', detail: { tags: ['Members'] } })
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/members',
    async ({ project, query }) => {
      const filters = { search: query.search, kind: query.kind };
      const [page, ownerCount] = await Promise.all([
        paginate(query, (window) => listMembersPage(project.id, { ...filters, ...window })),
        countOwners(project.id),
      ]);
      return { ...page, ownerCount };
    },
    {
      memberAdmin: ['members_manage', 'read'],
      query: memberListQuery,
      response: { 200: MemberPageResponse, ...accessErrors },
      detail: {
        summary: 'List project members',
        description:
          'One page of the project members, the newest membership first. `search` matches ' +
          'the name, the address or the handle, and `kind` narrows the list to the people or ' +
          'to the AI agents.',
        ...mcpTool('list_members'),
      },
    },
  )

  // Who the project can be filled from without an invite: the team's members who are
  // not in it yet.
  .get(
    '/projects/:projectKey/members/candidates',
    async ({ project }) => {
      return listMemberCandidates(project.id, project.teamId);
    },
    {
      memberAdmin: ['members_manage', 'create'],
      response: { 200: MemberCandidateListResponse, ...accessErrors },
      detail: {
        summary: 'List who can be added to the project',
        description:
          "The members of the project's team who are not in it yet. Anyone else is invited by " +
          'email instead.',
        ...mcpTool('list_member_candidates'),
      },
    },
  )

  // Someone already in the team joins a project directly; everyone else goes through
  // an invite, which puts them in the team first.
  .post(
    '/projects/:projectKey/members',
    async ({ project, body, user }) => {
      if (!(await getTeamMembership(project.teamId, body.userId))) {
        throw new HttpError(400, "This user is not a member of the project's team");
      }
      await assertMayGrantOwner(project, body.role, user);
      await assertAgentNotOwner(body.userId, body.role);
      // An explicit roleId must name a role of this project's team or a system role;
      // omitting it joins the member on the default role, as accepting an invite does.
      let roleId: number | null = null;
      if (body.role === 'member') {
        if (body.roleId != null) {
          const role = await getAssignableRole(project.teamId, body.roleId);
          if (!role) throw new HttpError(400, "roleId does not belong to this project's team");
          await assertGrantablePermissions(project, user, role.permissions);
          roleId = role.id;
        } else {
          roleId = await getDefaultRoleId();
        }
      }
      if (!(await addMember(project.id, body.userId, body.role, roleId))) {
        throw new HttpError(
          409,
          'This user is already a member of the project',
          'ALREADY_PROJECT_MEMBER',
        );
      }
      return noContent();
    },
    {
      body: addMemberBody,
      memberAdmin: ['members_manage', 'create'],
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Add a member',
        description:
          "Add a member of the project's team to the project, as an owner or on a custom role " +
          '(roleId, or null for the default role). Only a project owner or a team owner ' +
          'or manager adds an owner.',
        ...mcpTool('add_member'),
      },
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
      await assertMayGrantOwner(project, body.role, user);
      await assertAgentNotOwner(params.userId, body.role);
      // Changing an owner's role (demoting them) is owner business: the member
      // permission that edits roles must not let a non-owner unseat an owner.
      if (target === 'owner') await assertProjectAdmin(project, user);

      if (body.role === 'owner') {
        await setMembership(project.id, params.userId, 'owner', null);
        return noContent();
      }

      if (body.roleId != null) {
        const role = await getAssignableRole(project.teamId, body.roleId);
        if (!role) throw new HttpError(400, "roleId does not belong to this project's team");
        await assertGrantablePermissions(project, user, role.permissions);
      }
      const roleId = body.roleId ?? (await getDefaultRoleId());
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
      memberAdmin: ['members_manage', 'edit'],
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: "Update a member's role",
        description:
          "Set a member's role. 'owner' promotes to owner, which only a project owner or a team " +
          "owner or manager may grant; 'member' assigns a custom role by roleId, or null for " +
          'the default. You cannot change your own role, the last owner cannot be demoted, and ' +
          'a membership granted by a provisioned group is managed by the identity provider.',
        ...mcpTool('set_member_role'),
      },
    },
  )

  // The description is shown on the members page and given to agents so they can
  // pick who to tag on an unassigned issue.
  .patch(
    '/projects/:projectKey/members/:userId/description',
    async ({ project, params, body }) => {
      const ok = await setMemberDescription(project.id, params.userId, body.description);
      if (!ok) throw new HttpError(404, 'Member not found');
      return noContent();
    },
    {
      params: memberParams,
      body: setMemberDescriptionBody,
      memberSelfOrAdmin: ['members_manage', 'edit'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: "Set a member's description",
        description:
          'Set what a member does in the project. Up to 500 characters; empty string clears it.',
        ...mcpTool('set_member_description'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/members/:userId',
    async ({ project, params, user }) => {
      const target = await getMembership(project.id, params.userId);
      if (!target) throw new HttpError(404, 'Member not found');
      await assertNotProvisioned(project.id, params.userId);
      // Removing an owner is owner business (leaving yourself still works: an owner
      // passes this check). A non-owner cannot expel an owner.
      if (target === 'owner') await assertProjectAdmin(project, user);
      if (target === 'owner' && (await countOwners(project.id)) === 1) {
        throw new HttpError(400, 'A project must have at least one owner');
      }
      await removeMember(project.id, params.userId);
      return noContent();
    },
    {
      params: memberParams,
      memberSelfOrAdmin: ['members_manage', 'delete'],
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
