import { Elysia } from 'elysia';
import { authContext } from './auth-context';
import {
  requireProjectAccess,
  requireProjectPermission,
  requireProjectOwner,
  assertPermission,
  assertMcpEnabled,
  type AuthUser,
} from './access';
import { getProjectById } from '../projects/store';
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

// Builds a feature-local macro for routes that address an entity by its own id
// (no :projectKey in the path). resolveProjectId maps the route params to the
// entity's owning project id (null means the entity was not found). The macro
// asserts the given action on `resource` and injects the resolved `projectId` into
// the handler context, so a handler that needs it does not resolve it again. Used
// like:
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
) {
  return (action: PermissionAction) => ({
    async resolve({ params, user, request }: EntityGuardCtx) {
      const projectId = await resolveProjectId(params as Record<string, string>);
      if (projectId == null) throw new HttpError(404, notFound);
      await assertPermission(projectId, user, resource, action);
      if (isMcpRequest(request.headers)) {
        const project = await getProjectById(projectId);
        if (project) assertMcpEnabled(project, true);
      }
      return { projectId };
    },
  });
}

// The path param carried by every project-scoped route. The macros read it off
// the resolved params; Elysia always parses path segments, so it is present at
// runtime even on routes that do not declare a params schema.
type ProjectKeyParams = { projectKey: string };

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
        return { project };
      },
    };
  },

  // A specific permission on the role matrix (owners bypass the matrix).
  permission(permission: Permission) {
    return {
      async resolve({ params, user, request }) {
        const project = await requireProjectPermission(
          (params as ProjectKeyParams).projectKey,
          user,
          permission[0],
          permission[1],
        );
        assertMcpEnabled(project, isMcpRequest(request.headers));
        return { project };
      },
    };
  },

  // Owner-only actions (role and member management). A non-member gets 403 for
  // access rather than leaking owner-ness, since membership is resolved before
  // the owner check.
  projectOwner(_enabled: boolean) {
    return {
      async resolve({ params, user, request }) {
        const project = await requireProjectOwner((params as ProjectKeyParams).projectKey, user);
        assertMcpEnabled(project, isMcpRequest(request.headers));
        return { project };
      },
    };
  },
});
