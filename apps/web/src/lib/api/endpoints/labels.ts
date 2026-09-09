import { request } from '@/lib/api/core/client';

export interface Label {
  id: number;
  projectId: number;
  // The group this label belongs to, or null when ungrouped.
  groupId: number | null;
  name: string;
  color: string;
}

// A container a label can belong to. Labels reference it by groupId.
export interface LabelGroup {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

export const createLabel = (
  projectKey: string,
  input: { name: string; color?: string; groupId?: number | null },
) =>
  request<Label>(`/projects/${projectKey}/labels`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateLabel = (
  projectKey: string,
  labelId: number,
  patch: { name?: string; color?: string; groupId?: number | null },
) =>
  request<Label>(`/projects/${projectKey}/labels/${labelId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteLabel = (projectKey: string, labelId: number) =>
  request<void>(`/projects/${projectKey}/labels/${labelId}`, { method: 'DELETE' });

export const createLabelGroup = (projectKey: string, input: { name: string; color?: string }) =>
  request<LabelGroup>(`/projects/${projectKey}/label-groups`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateLabelGroup = (
  projectKey: string,
  groupId: number,
  patch: { name?: string; color?: string },
) =>
  request<LabelGroup>(`/projects/${projectKey}/label-groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteLabelGroup = (projectKey: string, groupId: number) =>
  request<void>(`/projects/${projectKey}/label-groups/${groupId}`, { method: 'DELETE' });
