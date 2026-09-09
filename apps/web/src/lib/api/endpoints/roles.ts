import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// The project permission matrix (mirrors apps/api shared/permissions.ts): each
// resource grants or denies 4 actions. A custom role carries one matrix.
export type PermissionAction = 'create' | 'edit' | 'read' | 'delete';

export type PermissionResource =
  | 'work_items'
  | 'initiatives'
  | 'cycles'
  | 'dashboards'
  | 'documents'
  | 'views'
  | 'members_invite'
  | 'members_manage'
  | 'states'
  | 'issue_types'
  | 'labels'
  | 'ai_agents'
  | 'integrations'
  | 'agent_skills'
  | 'agent_tools'
  | 'custom_fields'
  | 'issue_templates'
  | 'workflow_config'
  | 'actions'
  | 'webhooks'
  | 'note_boards'
  | 'danger_zone';

export type ResourcePermissions = Record<PermissionAction, boolean>;

export type Permissions = Record<PermissionResource, ResourcePermissions>;

// A project's custom role: a named permission matrix that can be assigned to a
// member. `isDefault` marks the fallback role new members get; it cannot be deleted.
export interface Role {
  id: number;
  name: string;
  isDefault: boolean;
  permissions: Permissions;
  createdAt: string;
}

// What a role list asks for: the window, and a search over the name.
export interface RoleListParams extends PageParams {
  search?: string;
}

// What a role is assigned to. Everything counted here is moved to another role
// before the role can be deleted.
export interface RoleUsage {
  members: number;
  agents: number;
  invites: number;
  // The provisioned group mappings that grant this role.
  groups: number;
}

// The resources and actions the role editor renders. Fetched so the UI matches the
// API's matrix without hardcoding the list in two places. `actions` is the full
// column set; a resource lists the subset it supports, and a cell outside that
// subset is always denied.
export interface PermissionCatalogResource {
  key: PermissionResource;
  actions: PermissionAction[];
}

export interface PermissionCatalog {
  resources: PermissionCatalogResource[];
  actions: PermissionAction[];
}

// Roles: a team's roles and the permission catalog behind the role editor. Roles
// belong to the team, so one list serves every project it owns; an owner or a
// manager of the team writes them, and only its owner deletes one.
export const getPermissionCatalog = () => request<PermissionCatalog>('/permission-catalog');

// One page of the team's roles. `search` matches the name.
export const listTeamRoles = (teamId: number, params: RoleListParams) =>
  request<Page<Role>>(`/teams/${teamId}/roles${pageQuery(params, { search: params.search })}`);

// Every role of the team, with its matrix: what the role pickers assign from and
// what the clipboard export carries.
export const listTeamRoleOptions = (teamId: number) =>
  request<Role[]>(`/teams/${teamId}/roles/options`);

export const createRole = (teamId: number, input: { name: string; permissions: Permissions }) =>
  request<Role>(`/teams/${teamId}/roles`, { method: 'POST', body: JSON.stringify(input) });

export const updateRole = (
  teamId: number,
  roleId: number,
  patch: { name?: string; permissions?: Permissions },
) =>
  request<Role>(`/teams/${teamId}/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const getRoleUsage = (teamId: number, roleId: number) =>
  request<RoleUsage>(`/teams/${teamId}/roles/${roleId}/usage`);

export const deleteRole = (teamId: number, roleId: number, targetRoleId?: number) => {
  const qs = targetRoleId === undefined ? '' : `?targetRoleId=${targetRoleId}`;
  return request<void>(`/teams/${teamId}/roles/${roleId}${qs}`, { method: 'DELETE' });
};
