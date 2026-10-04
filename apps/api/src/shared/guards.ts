import { Elysia, type DocumentDecoration } from 'elysia';
import { workspaceScim as isScimPerWorkspace } from '@repo/auth';
import { authContext } from './auth-context';
import {
  requireProjectAccess,
  requireProjectPermission,
  requireProjectOwner,
  requireProjectAdmin,
  requireTeamRunsProject,
  requireMemberAdmin,
  requireSelfOrMemberAdmin,
  requireTeamMembership,
  requireTeamPermission,
  assertPermission,
  assertMcpEnabled,
  assertWritable,
  assertProjectWritable,
  assertFeatureEnabled,
  assertProjectFeature,
  type AuthUser,
} from './access';
import type { ProjectFeature } from './features';
import { getProjectById } from '#modules/projects/service';
import { runsTeam, teamMcpEnabled } from '#modules/teams/service';
import { requireWorkspaceManager } from '#modules/workspaces/service';
import { isMcpRequest } from './mcp-request';
import { HttpError } from './lib';
import type { PermissionResource, PermissionAction } from './permissions';

// A [resource, action] pair naming one cell of the role permission matrix.
export type Permission = [PermissionResource, PermissionAction];

// The slice of the request context an entity guard reads. Annotated explicitly
// because the factory is defined outside a plugin, so there is no context to
// infer from. It is a supertype of Elysia's route context (params widened, user
// optional) so the resolve is assignable wherever the macro is used; `user` is
// populated at runtime by authContext.
type EntityGuardCtx = {
  params: Record<string, unknown>;
  user?: AuthUser | null;
  request: Request;
};

// The permission a route requires, as an OpenAPI extension on its detail. Elysia
// deletes a macro's own key from the route once it expands the macro, so this is
// where the MCP tool table reads what a route requires (see generate.ts) rather than
// from a second list of the same pairs kept by hand. Every guard below states it;
// spread it into `detail` directly on a route that asserts its permission in the
// handler instead of through a guard.
export function requiresPermission(permission: Permission): { 'x-permission': Permission } {
  return { 'x-permission': permission };
}

// Elysia merges a `detail` a macro returns into the route's own, which is how a
// guard reaches the route's detail at all. The cast is for the extension key alone:
// DocumentDecoration has every property optional, so an object carrying only an
// `x-` key shares none with it and TypeScript rejects it as a weak type.
function permissionDetail(permission: Permission) {
  return { detail: requiresPermission(permission) as DocumentDecoration };
}

// Builds a feature-local macro for routes that address an entity by its own id
// (no :projectKey in the path). resolveProjectId maps the route params to the
// entity's owning project id (null means the entity was not found). The macro
// asserts the given action on `resource` and injects the resolved `projectId` into
// the handler context, so a handler that needs it does not resolve it again. `feature`
// names the optional section the entity belongs to, closing every route of the macro
// while the project has that section off. Used like:
//
//   .macro({
//     workItem: entityGuard("work_items", "Issue not found",
//       (p) => getIssueProjectId(Number(p.issueId))),
//   })
//   .patch("/issues/:issueId", handler, { workItem: "edit" })
export function entityGuard(
  resource: PermissionResource,
  notFound: string,
  resolveProjectId: (params: Record<string, string>) => Promise<number | null>,
  feature?: ProjectFeature,
) {
  return (action: PermissionAction) => ({
    ...permissionDetail([resource, action]),
    async resolve({ params, user, request }: EntityGuardCtx) {
      const projectId = await resolveProjectId(params as Record<string, string>);
      if (projectId == null) throw new HttpError(404, notFound);
      await assertPermission(projectId, user, resource, action);
      if (feature) await assertProjectFeature(projectId, feature);
      await assertMcpAllowed(projectId, request.headers);
      await assertProjectWritable(projectId, request.method);
      return { projectId };
    },
  });
}

// The per-project MCP toggle, for a route or a guard that resolved the project by
// its id rather than through one of the :projectKey macros. A plain request passes
// untouched.
export async function assertMcpAllowed(projectId: number, headers: Headers): Promise<void> {
  if (!isMcpRequest(headers)) return;
  const project = await getProjectById(projectId);
  if (project) assertMcpEnabled(project, true);
}

// The path param carried by every project-scoped route. The macros read it off
// the resolved params; Elysia always parses path segments, so it is present at
// runtime even on routes that do not declare a params schema.
type ProjectKeyParams = { projectKey: string };

// The path param carried by every team-scoped route, and its resolution to the
// caller's membership — shared by the three team macros below.
type TeamIdParams = { teamId: string };

type WorkspaceIdParams = { workspaceId: string };

function resolveTeam(params: unknown, user: AuthUser | undefined | null) {
  return requireTeamMembership(Number((params as TeamIdParams).teamId), user);
}

// The team's MCP switch, for the team-scoped routes. Their resources — the agents,
// the skills, the tools, the roles and the integration credentials — belong to the
// team rather than to a project, so no project flag covers them; this is what does.
// A plain request passes untouched.
async function assertTeamMcpAllowed(params: unknown, headers: Headers): Promise<void> {
  if (!isMcpRequest(headers)) return;
  const teamId = Number((params as TeamIdParams).teamId);
  if (!(await teamMcpEnabled(teamId))) throw new HttpError(403, 'MCP is disabled for this team');
}

// Declarative access guards for routes whose path carries :projectKey. Each
// macro resolves the project once, enforces access, and injects the resolved
// `project` row into the handler context, so a handler reads `project` instead
// of resolving and checking it itself.
//
// The plugin uses authContext, so `user` is on the context before a guard runs.
// A feature plugin with :projectKey routes does `.use(guards)` at the top of its
// chain and sets the guard in each route's options:
//
//   .post("/projects/:projectKey/columns", ({ project, body }) => ..., {
//     permission: ["states", "create"],
//   })
//
// A guard that denies throws an HttpError, which the planner onError maps to the
// JSON error response.
export const guards = new Elysia({ name: 'guards' }).use(authContext).macro({
  // Bare membership: any member of the project may proceed.
  projectMember(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const project = await requireProjectAccess((params as ProjectKeyParams).projectKey, user);
        assertMcpEnabled(project, isMcpRequest(request.headers));
        assertWritable(project, request.method);
        return { project };
      },
    };
  },

  // The optional section a route belongs to, set beside the permission the route
  // asserts. A section its project has turned off closes its routes, so what the
  // settings page hides cannot be reached through the API either. It resolves the
  // project through the membership check as well, so it belongs on a route that
  // already requires membership — not on one a team owner reaches without it.
  feature(name: ProjectFeature) {
    return {
      async resolve({ params, user }) {
        const project = await requireProjectAccess((params as ProjectKeyParams).projectKey, user);
        assertFeatureEnabled(project, name);
      },
    };
  },

  // A specific permission on the role matrix (owners bypass the matrix).
  permission(permission: Permission) {
    return {
      ...permissionDetail(permission),
      async resolve({ params, user, request }) {
        const project = await requireProjectPermission(
          (params as ProjectKeyParams).projectKey,
          user,
          permission[0],
          permission[1],
        );
        assertMcpEnabled(project, isMcpRequest(request.headers));
        // Deleting the project is the one change an archived project still takes.
        if (permission[0] !== 'danger_zone') assertWritable(project, request.method);
        return { project };
      },
    };
  },

  // Owner-only actions (member management). A non-member gets 403 for access
  // rather than leaking owner-ness, since membership is resolved before the owner
  // check.
  projectOwner(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const project = await requireProjectOwner((params as ProjectKeyParams).projectKey, user);
        assertMcpEnabled(project, isMcpRequest(request.headers));
        assertWritable(project, request.method);
        return { project };
      },
    };
  },

  // The project's own settings — MCP access and the optional sections — which its
  // owner and the team that runs it both govern.
  projectAdmin(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const project = await requireProjectAdmin((params as ProjectKeyParams).projectKey, user);
        assertMcpEnabled(project, isMcpRequest(request.headers));
        assertWritable(project, request.method);
        return { project };
      },
    };
  },

  // A project the caller's team runs, for what follows their rank in the team rather
  // than any project role: copying the project into one of their own.
  // Copying only reads the source, so an archived project can still be copied.
  teamRunsProject(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const project = await requireTeamRunsProject((params as ProjectKeyParams).projectKey, user);
        assertMcpEnabled(project, isMcpRequest(request.headers));
        return { project };
      },
    };
  },

  // One member's own row, addressed by :userId: the member themselves act on it
  // without a member permission, everyone else needs what memberAdmin asks for.
  memberSelfOrAdmin(permission: Permission) {
    return {
      ...permissionDetail(permission),
      async resolve({ params, user, request }) {
        const { projectKey, userId } = params as ProjectKeyParams & { userId: string };
        const project = await requireSelfOrMemberAdmin(
          projectKey,
          userId,
          user,
          permission[0],
          permission[1],
        );
        assertMcpEnabled(project, isMcpRequest(request.headers));
        assertWritable(project, request.method);
        return { project };
      },
    };
  },

  // The project's member list: a permission from the role matrix, or the standing of
  // a team owner or manager, who run the team's projects without being in them.
  memberAdmin(permission: Permission) {
    return {
      ...permissionDetail(permission),
      async resolve({ params, user, request }) {
        const project = await requireMemberAdmin(
          (params as ProjectKeyParams).projectKey,
          user,
          permission[0],
          permission[1],
        );
        assertMcpEnabled(project, isMcpRequest(request.headers));
        assertWritable(project, request.method);
        return { project };
      },
    };
  },

  // Any member of the team may proceed. The team macros inject the resolved
  // `membership` into the handler context.
  teamMember(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const membership = await resolveTeam(params, user);
        await assertTeamMcpAllowed(params, request.headers);
        return { membership };
      },
    };
  },

  // Owner or manager. They run the team's projects: create, copy and update one. A
  // member does not, and neither does an agent, whose standing in the team says only
  // that it belongs to it.
  teamManager(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const membership = await resolveTeam(params, user);
        if (!runsTeam(membership.role))
          throw new HttpError(403, 'Only a team owner or manager can do this');
        await assertTeamMcpAllowed(params, request.headers);
        return { membership };
      },
    };
  },

  // A resource the team owns and every project of it shares. Owners and managers of
  // the team pass, so does an owner of one of its projects; anyone else passes when a
  // project role of theirs in the team grants the permission.
  teamPermission(permission: Permission) {
    return {
      ...permissionDetail(permission),
      async resolve({ params, user, request }) {
        const { teamId } = params as TeamIdParams;
        const membership = await requireTeamPermission(
          Number(teamId),
          user,
          permission[0],
          permission[1],
        );
        await assertTeamMcpAllowed(params, request.headers);
        return { membership };
      },
    };
  },

  // The workspace's owner or an admin. The workspace macros inject the resolved
  // `standing` into the handler context.
  workspaceManager(_enabled: boolean) {
    return {
      async resolve({ params, user }) {
        const standing = await requireWorkspaceManager(
          Number((params as WorkspaceIdParams).workspaceId),
          user,
        );
        return { standing };
      },
    };
  },

  // Only the owner appoints and removes the admins.
  workspaceOwner(_enabled: boolean) {
    return {
      async resolve({ params, user }) {
        const standing = await requireWorkspaceManager(
          Number((params as WorkspaceIdParams).workspaceId),
          user,
        );
        if (standing.role !== 'owner')
          throw new HttpError(403, 'Only the workspace owner can do this');
        return { standing };
      },
    };
  },

  // SCIM creates accounts and attaches existing ones to the workspace, which reaches past
  // the workspace to the whole instance, so only the instance owner sets it up, in a
  // workspace they own, unless SCIM is set up per workspace (setWorkspaceScim in
  // @repo/auth).
  workspaceScim(_enabled: boolean) {
    return {
      async resolve({ params, user }) {
        const standing = await requireWorkspaceManager(
          Number((params as WorkspaceIdParams).workspaceId),
          user,
        );
        const perWorkspace = isScimPerWorkspace();
        if (standing.role !== 'owner' || (!perWorkspace && user?.role !== 'god')) {
          throw new HttpError(
            403,
            `Only the ${perWorkspace ? 'workspace' : 'instance'} owner sets up SCIM provisioning`,
          );
        }
        return { standing };
      },
    };
  },

  // Owner-only actions (renaming the team, its roles, deleting a project). A
  // non-member gets the same 404 as for an unknown team, since membership is
  // resolved before the owner check.
  teamOwner(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const membership = await resolveTeam(params, user);
        if (membership.role !== 'owner') throw new HttpError(403, 'Only a team owner can do this');
        await assertTeamMcpAllowed(params, request.headers);
        return { membership };
      },
    };
  },
});
