import type { FilterSet } from '@/utils/filters';
import { request } from '@/lib/api/core/client';
import type { IssuePatch } from '@/lib/api/endpoints/issues';

// A manual action: a saved macro on a project. `condition` is a FilterSet (empty
// = always available) that decides which issues the action shows on; `effect`
// is a partial issue patch over built-in fields applied in one update when the
// action runs. A present effect key sets that field (value may be null); an
// absent key leaves it unchanged.
export type ActionEffect = Pick<
  IssuePatch,
  'columnId' | 'assigneeUserId' | 'priority' | 'typeId' | 'startDate' | 'dueDate' | 'labelIds'
>;

export interface ActionDef {
  id: number;
  projectId: number;
  name: string;
  icon: string;
  condition: FilterSet;
  effect: ActionEffect;
  position: number;
  createdAt: string;
}

export interface NewActionInput {
  name: string;
  icon?: string;
  condition?: FilterSet;
  effect?: ActionEffect;
}

export interface ActionPatch {
  name?: string;
  icon?: string;
  condition?: FilterSet;
  effect?: ActionEffect;
}

// The action list any project member may read; the permissioned list route is
// for API/MCP callers.
export const listQuickActions = (projectKey: string) =>
  request<ActionDef[]>(`/projects/${projectKey}/actions/quick`);

export const createAction = (projectKey: string, input: NewActionInput) =>
  request<ActionDef>(`/projects/${projectKey}/actions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateAction = (actionId: number, patch: ActionPatch) =>
  request<ActionDef>(`/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteAction = (actionId: number) =>
  request<void>(`/actions/${actionId}`, { method: 'DELETE' });

export const reorderActions = (projectKey: string, orderedIds: number[]) =>
  request<ActionDef[]>(`/projects/${projectKey}/actions/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
