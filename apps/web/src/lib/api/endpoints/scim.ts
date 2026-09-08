import { request } from '@/lib/api/core/client';

// SCIM provisioning. The token is never returned, only its prefix; a new one is
// generated with createInstanceScimToken and shown once.
export interface InstanceScimSettings {
  enabled: boolean;
  hasToken: boolean;
  tokenPrefix: string;
  baseUrl: string;
}

// What a provisioned group grants: membership in a project, at a role. The group and
// its members come from the identity provider; the mappings are set here.
export interface InstanceScimGroupMapping {
  projectId: number;
  projectKey: string;
  projectName: string;
  role: 'owner' | 'member';
  roleId: number | null;
}

export interface InstanceScimGroup {
  id: string;
  displayName: string;
  externalId: string | null;
  memberCount: number;
  mappings: InstanceScimGroupMapping[];
}

export const getInstanceScimSettings = () => request<InstanceScimSettings>('/god/scim-settings');

export const updateInstanceScimSettings = (patch: { enabled: boolean }) =>
  request<InstanceScimSettings>('/god/scim-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

// Returns the new token in the clear. It is shown once and cannot be read back.
export const createInstanceScimToken = () =>
  request<{ token: string }>('/god/scim-settings/token', { method: 'POST' });

export const listInstanceScimGroups = () => request<InstanceScimGroup[]>('/god/scim-groups');

export const setInstanceScimGroupMappings = (
  groupId: string,
  mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[],
) =>
  request<InstanceScimGroup>(`/god/scim-groups/${groupId}/mappings`, {
    method: 'PUT',
    body: JSON.stringify({ mappings }),
  });
