import { request } from '@/lib/api/core/client';

// A named set of a project's members that an issue can be assigned to, alongside or
// instead of one person. Issues reference it by assigneeGroupId.
export interface ProjectGroup {
  id: number;
  projectId: number;
  name: string;
  color: string;
  position: number;
  memberIds: string[];
}

export const createGroup = (
  projectKey: string,
  input: { name: string; color?: string; memberIds?: string[] },
) =>
  request<ProjectGroup>(`/projects/${projectKey}/groups`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateGroup = (
  projectKey: string,
  groupId: number,
  patch: { name?: string; color?: string },
) =>
  request<ProjectGroup>(`/projects/${projectKey}/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteGroup = (projectKey: string, groupId: number) =>
  request<void>(`/projects/${projectKey}/groups/${groupId}`, { method: 'DELETE' });

export const setGroupMembers = (projectKey: string, groupId: number, userIds: string[]) =>
  request<ProjectGroup>(`/projects/${projectKey}/groups/${groupId}/members`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  });
