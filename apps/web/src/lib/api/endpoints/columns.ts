import { request } from '@/lib/api/core/client';

export type StateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface Column {
  id: number;
  projectId: number;
  name: string;
  stateType: StateType;
  color: string;
  position: number;
  // How many issues the column should hold, or null for no limit. wipMode decides
  // whether passing it only warns on the board or is refused outright.
  wipLimit: number | null;
  wipMode: WipMode;
  // The member every issue entering this column is assigned to, replacing whoever
  // held it.
  autoAssignUserId: string | null;
}

export type WipMode = 'soft' | 'hard';

export const createColumn = (
  projectKey: string,
  input: {
    name: string;
    stateType: StateType;
    color?: string;
    wipLimit?: number | null;
    wipMode?: WipMode;
    autoAssignUserId?: string | null;
  },
) =>
  request<Column>(`/projects/${projectKey}/columns`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateColumn = (
  projectKey: string,
  columnId: number,
  patch: {
    name?: string;
    stateType?: StateType;
    color?: string;
    // null clears the limit; absent leaves it as it is.
    wipLimit?: number | null;
    wipMode?: WipMode;
    // null clears the automatic assignment; absent leaves it as it is.
    autoAssignUserId?: string | null;
  },
) =>
  request<Column>(`/projects/${projectKey}/columns/${columnId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const reorderColumns = (projectKey: string, orderedIds: number[]) =>
  request<Column[]>(`/projects/${projectKey}/columns/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });

export const deleteColumn = (
  projectKey: string,
  columnId: number,
  body: { mode: 'move'; targetColumnId: number } | { mode: 'delete' },
) =>
  request<void>(`/projects/${projectKey}/columns/${columnId}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
