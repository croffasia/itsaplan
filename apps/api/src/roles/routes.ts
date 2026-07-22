import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { guards } from '../shared/guards';
import { HttpError, rethrowDuplicate } from '../shared/lib';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../shared/permissions';
import { ErrorResponse } from '../shared/responses';
import { listRoles, getRole, createRole, updateRole, deleteRole } from './store';

const roleParams = t.Object({ projectKey: t.String(), roleId: t.Numeric() });

// Permission matrix carried on create/update. Kept loose (a jsonb blob) and
// sanitized by normalizePermissions in the store: unknown keys are dropped,
// values coerced to booleans, missing entries defaulted to false.
const permissions = t.Any();

// The permission matrix as returned: for each resource, the create/edit/read/
// delete flags. normalizePermissions always fills every resource and action.
const PermissionMatrix = t.Record(t.String(), t.Record(t.String(), t.Boolean()));

// A role DTO (RoleRow from the store).
const RoleResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  isDefault: t.Boolean(),
  permissions: PermissionMatrix,
  createdAt: t.String(),
});

// The catalog of resources and actions a role's matrix is built from.
const PermissionCatalogResponse = t.Object({
  resources: t.Array(t.String()),
  actions: t.Array(t.String()),
});

// Roles CRUD. Listing is open to any member; creating, editing, and deleting a
// role are owner-only. Role management is deliberately not delegated through the
// permission matrix (a member with members_manage could otherwise grant itself a
// more powerful role) — only owners manage roles.
export const roleRoutes = new Elysia({ name: 'roles', detail: { tags: ['Roles'] } })
  .use(guards)

  // The catalog of resources and actions a role's permission matrix is built
  // from. Static; any authenticated user may read it to render a role editor.
  .get(
    '/permission-catalog',
    () => ({ resources: [...PERMISSION_RESOURCES], actions: [...PERMISSION_ACTIONS] }),
    {
      response: {
        200: PermissionCatalogResponse,
        401: ErrorResponse,
      },
      detail: {
        summary: 'List the permission catalog',
        description: "List the resources and actions a role's permission matrix is built from.",
        ...mcpTool('list_permission_catalog'),
      },
    },
  )

  .get(
    '/projects/:projectKey/roles',
    async ({ project }) => {
      return listRoles(project.id);
    },
    {
      params: t.Object({ projectKey: t.String() }),
      projectMember: true,
      response: {
        200: t.Array(RoleResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's roles", ...mcpTool('list_roles') },
    },
  )

  .post(
    '/projects/:projectKey/roles',
    async ({ project, body, set }) => {
      try {
        set.status = 201;
        return await createRole(project.id, body);
      } catch (err) {
        rethrowDuplicate(err, 'role');
      }
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({ name: t.String({ minLength: 1 }), permissions }),
      projectOwner: true,
      response: {
        201: RoleResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: { summary: 'Create a role', ...mcpTool('create_role') },
    },
  )

  .patch(
    '/projects/:projectKey/roles/:roleId',
    async ({ project, params, body }) => {
      let role;
      try {
        role = await updateRole(project.id, params.roleId, body);
      } catch (err) {
        rethrowDuplicate(err, 'role');
      }
      if (!role) throw new HttpError(404, 'Role not found');
      return role;
    },
    {
      params: roleParams,
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        permissions: t.Optional(permissions),
      }),
      projectOwner: true,
      response: {
        200: RoleResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Update a role',
        description: 'Update a role.',
        ...mcpTool('update_role'),
      },
    },
  )

  // Deletes a custom role. The default role cannot be deleted. Members on the
  // role are reassigned to the default role.
  .delete(
    '/projects/:projectKey/roles/:roleId',
    async ({ project, params }) => {
      const role = await getRole(project.id, params.roleId);
      if (!role) throw new HttpError(404, 'Role not found');
      if (role.isDefault) throw new HttpError(400, 'The default role cannot be deleted');
      await deleteRole(project.id, params.roleId);
      return noContent();
    },
    {
      params: roleParams,
      projectOwner: true,
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a role',
        description: 'Delete a custom role. The default role cannot be deleted.',
        ...mcpTool('delete_role'),
      },
    },
  );
