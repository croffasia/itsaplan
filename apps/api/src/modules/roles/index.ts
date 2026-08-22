import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { HttpError, rethrowDuplicate } from '#shared/lib';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '#shared/permissions';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { listRoles, getRole, createRole, updateRole, deleteRole } from './service';
import {
  PermissionCatalogResponse,
  RoleResponse,
  createRoleBody,
  projectKeyParams,
  roleParams,
  updateRoleBody,
} from './model';

// Roles CRUD. Listing is open to any member; creating, editing, and deleting a
// role are owner-only. Role management is deliberately not delegated through the
// permission matrix (a member with members_manage could otherwise grant itself a
// more powerful role) — only owners manage roles.
export const roleRoutes = new Elysia({ name: 'roles', detail: { tags: ['Roles'] } })
  .use(guards)

  // Static; any authenticated user may read it to render a role editor.
  .get(
    '/permission-catalog',
    () => ({ resources: [...PERMISSION_RESOURCES], actions: [...PERMISSION_ACTIONS] }),
    {
      response: { 200: PermissionCatalogResponse, ...errors(401) },
      detail: {
        summary: 'List the permission catalog',
        description: "List the resources and actions a role's permission matrix is built from.",
        ...mcpTool('list_permission_catalog'),
      },
    },
  )

  .get('/projects/:projectKey/roles', ({ project }) => listRoles(project.id), {
    params: projectKeyParams,
    projectMember: true,
    response: { 200: t.Array(RoleResponse), ...accessErrors },
    detail: { summary: "List a project's roles", ...mcpTool('list_roles') },
  })

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
      params: projectKeyParams,
      body: createRoleBody,
      projectOwner: true,
      response: { 201: RoleResponse, ...commonErrors, ...errors(409) },
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
      body: updateRoleBody,
      projectOwner: true,
      response: { 200: RoleResponse, ...commonErrors, ...errors(409) },
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
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a role',
        description: 'Delete a custom role. The default role cannot be deleted.',
        ...mcpTool('delete_role'),
      },
    },
  );
