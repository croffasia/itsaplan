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

// `deletion` says whether the owner may delete it: `work` while a team of it holds a
// project or an AI agent. `maxConcurrentRuns` is its own run limit, 0 for none, and
// `maxConcurrentRunsCap` the highest the instance allows it, 0 for no ceiling.
export interface Workspace {
  id: number;
  name: string;
  role: WorkspaceRole;
  managerCount: number;
  color: string | null;
  teamCreation: TeamCreation;
  maxConcurrentRuns: number;
  maxConcurrentRunsCap: number;
  deletion: 'allowed' | 'work';
}

export interface WorkspacePatch {
  name?: string;
  color?: string | null;
  teamCreation?: TeamCreation;
  maxConcurrentRuns?: number;
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

// SCIM provisioning of a workspace, or of the instance in god mode when `workspaceId` is
// null. The token is never returned, only its prefix; a new one is generated with
// createWorkspaceScimToken and shown once.
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

// A project a group may grant, as the group mapping form picks it, with the roles of
// the team that owns it.
export interface WorkspaceProjectOption {
  id: number;
  key: string;
  name: string;
  roles: { id: number; name: string }[];
}

const scimPath = (workspaceId: number | null) =>
  workspaceId === null ? '/god/scim' : `/workspaces/${workspaceId}/scim`;

export const getWorkspaceScim = (workspaceId: number | null) =>
  request<WorkspaceScimSettings>(scimPath(workspaceId));

export const updateWorkspaceScim = (workspaceId: number | null, patch: { enabled: boolean }) =>
  request<WorkspaceScimSettings>(scimPath(workspaceId), {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

// Returns the new token in the clear. It is shown once and cannot be read back.
export const createWorkspaceScimToken = (workspaceId: number | null) =>
  request<{ token: string }>(`${scimPath(workspaceId)}/token`, { method: 'POST' });

export const listWorkspaceScimGroups = (workspaceId: number | null) =>
  request<WorkspaceScimGroup[]>(`${scimPath(workspaceId)}/groups`);

export const setWorkspaceScimGroupMappings = (
  workspaceId: number | null,
  groupId: string,
  mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[],
) =>
  request<WorkspaceScimGroup>(`${scimPath(workspaceId)}/groups/${groupId}/mappings`, {
    method: 'PUT',
    body: JSON.stringify({ mappings }),
  });

export const listWorkspaceProjectOptions = (workspaceId: number | null) =>
  request<WorkspaceProjectOption[]>(`${scimPath(workspaceId)}/projects`);
