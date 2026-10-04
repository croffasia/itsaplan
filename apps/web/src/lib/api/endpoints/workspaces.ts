import { request } from '@/lib/api/core/client';

export type WorkspaceRole = 'owner' | 'admin';

// A workspace the caller sees. `role` is null for somebody who is only in a team of it.
export interface WorkspaceSummary {
  id: number;
  name: string;
  role: WorkspaceRole | null;
  color: string | null;
  canCreateTeam: boolean;
}

// Who creates teams in a workspace: the owner alone, the owner and admins, or anyone in
// one of its teams.
export type TeamCreation = 'owner' | 'managers' | 'members';

// `deletion` says whether the owner may delete it: `instance` for the instance workspace,
// which stays; `work` while a team of it holds a project or an AI agent.
export interface Workspace {
  id: number;
  name: string;
  role: WorkspaceRole;
  managerCount: number;
  color: string | null;
  teamCreation: TeamCreation;
  deletion: 'allowed' | 'instance' | 'work';
}

export interface WorkspacePatch {
  name?: string;
  color?: string | null;
  teamCreation?: TeamCreation;
}

export interface WorkspacePerson {
  userId: string;
  name: string;
  email: string;
  image: string | null;
}

export interface WorkspaceManager extends WorkspacePerson {
  role: WorkspaceRole;
}

export const listWorkspaces = () => request<WorkspaceSummary[]>('/workspaces');

export const getWorkspace = (workspaceId: number) =>
  request<Workspace>(`/workspaces/${workspaceId}`);

export const updateWorkspace = (workspaceId: number, input: WorkspacePatch) =>
  request<Workspace>(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteWorkspace = (workspaceId: number) =>
  request<void>(`/workspaces/${workspaceId}`, { method: 'DELETE' });

export const listWorkspaceManagers = (workspaceId: number) =>
  request<WorkspaceManager[]>(`/workspaces/${workspaceId}/managers`);

export const listWorkspaceManagerCandidates = (workspaceId: number, search: string) =>
  request<WorkspacePerson[]>(
    `/workspaces/${workspaceId}/managers/candidates?${new URLSearchParams({ search })}`,
  );

export const addWorkspaceAdmin = (workspaceId: number, userId: string) =>
  request<WorkspaceManager[]>(`/workspaces/${workspaceId}/managers`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const removeWorkspaceAdmin = (workspaceId: number, userId: string) =>
  request<void>(`/workspaces/${workspaceId}/managers/${userId}`, { method: 'DELETE' });

// SCIM provisioning. The token is never returned, only its prefix; a new one is
// generated with createWorkspaceScimToken and shown once.
export interface WorkspaceScimSettings {
  enabled: boolean;
  hasToken: boolean;
  tokenPrefix: string;
  baseUrl: string;
}

// What a provisioned group grants: membership in a project, at a role. The group and
// its members come from the identity provider; the mappings are set here.
export interface WorkspaceScimGroupMapping {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: 'owner' | 'member';
  roleId: number | null;
}

export interface WorkspaceScimGroup {
  id: string;
  displayName: string;
  externalId: string | null;
  memberCount: number;
  mappings: WorkspaceScimGroupMapping[];
}

// A project of the workspace as the group mapping form picks it, with the roles of
// the team that owns it.
export interface WorkspaceProjectOption {
  id: number;
  key: string;
  name: string;
  roles: { id: number; name: string }[];
}

export const getWorkspaceScim = (workspaceId: number) =>
  request<WorkspaceScimSettings>(`/workspaces/${workspaceId}/scim`);

export const updateWorkspaceScim = (workspaceId: number, patch: { enabled: boolean }) =>
  request<WorkspaceScimSettings>(`/workspaces/${workspaceId}/scim`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

// Returns the new token in the clear. It is shown once and cannot be read back.
export const createWorkspaceScimToken = (workspaceId: number) =>
  request<{ token: string }>(`/workspaces/${workspaceId}/scim/token`, { method: 'POST' });

export const listWorkspaceScimGroups = (workspaceId: number) =>
  request<WorkspaceScimGroup[]>(`/workspaces/${workspaceId}/scim/groups`);

export const setWorkspaceScimGroupMappings = (
  workspaceId: number,
  groupId: string,
  mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[],
) =>
  request<WorkspaceScimGroup>(`/workspaces/${workspaceId}/scim/groups/${groupId}/mappings`, {
    method: 'PUT',
    body: JSON.stringify({ mappings }),
  });

export const listWorkspaceProjectOptions = (workspaceId: number) =>
  request<WorkspaceProjectOption[]>(`/workspaces/${workspaceId}/projects/options`);
