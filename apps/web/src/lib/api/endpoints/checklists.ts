import { request } from '@/lib/api/core/client';

// One checkbox line of a checklist.
export interface ChecklistItem {
  id: number;
  content: string;
  done: boolean;
  position: number;
}

// A checklist on an issue: steps too small to be subtasks of their own. Both the
// checklists of an issue and the items of a checklist come back in display order.
export interface Checklist {
  id: number;
  title: string;
  position: number;
  items: ChecklistItem[];
}

// Checklists on an issue. The issue read already carries them, so there is no
// list call of their own — a write refreshes that read.
export const createChecklist = (issueId: number, title: string) =>
  request<Checklist>(`/issues/${issueId}/checklists`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });

export const renameChecklist = (checklistId: number, title: string) =>
  request<Checklist>(`/checklists/${checklistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const deleteChecklist = (checklistId: number) =>
  request<void>(`/checklists/${checklistId}`, { method: 'DELETE' });

export const reorderChecklists = (issueId: number, orderedIds: number[]) =>
  request<Checklist[]>(`/issues/${issueId}/checklists/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });

export const createChecklistItem = (checklistId: number, content: string) =>
  request<ChecklistItem>(`/checklists/${checklistId}/items`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

export const updateChecklistItem = (itemId: number, patch: { content?: string; done?: boolean }) =>
  request<ChecklistItem>(`/checklists/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteChecklistItem = (itemId: number) =>
  request<void>(`/checklists/items/${itemId}`, { method: 'DELETE' });

export const reorderChecklistItems = (checklistId: number, orderedIds: number[]) =>
  request<ChecklistItem[]>(`/checklists/${checklistId}/items/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
