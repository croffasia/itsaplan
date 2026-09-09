import { request } from '@/lib/api/core/client';

export interface IssueType {
  id: number;
  projectId: number;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  position: number;
}

export const createIssueType = (
  projectKey: string,
  input: { name: string; icon?: string; color?: string; isDefault?: boolean },
) =>
  request<IssueType>(`/projects/${projectKey}/issue-types`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateIssueType = (
  projectKey: string,
  typeId: number,
  patch: { name?: string; color?: string; isDefault?: boolean },
) =>
  request<IssueType>(`/projects/${projectKey}/issue-types/${typeId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteIssueType = (projectKey: string, typeId: number) =>
  request<void>(`/projects/${projectKey}/issue-types/${typeId}`, { method: 'DELETE' });
