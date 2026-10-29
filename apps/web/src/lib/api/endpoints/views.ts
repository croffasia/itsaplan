import type { FilterSet } from '@/utils/filters';
import type { SavedViewDisplay } from '@/utils/viewSettings';
import { request } from '@/lib/api/core/client';

// A saved view (a tab above the work items view): a named filter set plus a display
// snapshot (layout + that layout's settings). A project's view is shared by the
// project, a private one is seen only by its creator; `favorite` and `hidden` are per
// user, and the list comes in the order of the user's own tab row.
// filters/display are stored as jsonb.
export interface View {
  id: number;
  projectId: number;
  name: string;
  icon: string | null;
  filters: FilterSet;
  display: SavedViewDisplay;
  position: number;
  // Unguessable token for the public read-only share link, or null when not shared.
  shareToken: string | null;
  // Whether the share link exposes the full issues (assignees, labels, custom
  // fields, activity) or only their title, description, state, type, priority,
  // dates, subtasks and links.
  shareExtended: boolean;
  // Seen only by the current user, who created it, until they add it to the project. It
  // has no share link, and mixes with the project's views only in the user's own tab row.
  isPrivate: boolean;
  // Whether the current user marked the view as a favorite: its tab carries a star and
  // the view is listed under Work items in the sidebar.
  favorite: boolean;
  // Whether the current user hid this project's view from their tab row.
  hidden: boolean;
  createdAt: string;
}

export interface NewViewInput {
  name: string;
  icon?: string | null;
  filters?: FilterSet;
  display?: SavedViewDisplay;
  isPrivate?: boolean;
}

export interface ViewPatch {
  name?: string;
  icon?: string | null;
  filters?: FilterSet;
  display?: SavedViewDisplay;
}

export const listViews = (projectKey: string, signal?: AbortSignal) =>
  request<View[]>(`/projects/${encodeURIComponent(projectKey)}/views`, { signal });

export const createView = (projectKey: string, input: NewViewInput) =>
  request<View>(`/projects/${projectKey}/views`, { method: 'POST', body: JSON.stringify(input) });

export const updateView = (viewId: number, patch: ViewPatch) =>
  request<View>(`/views/${viewId}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteView = (viewId: number) =>
  request<void>(`/views/${viewId}`, { method: 'DELETE' });

export const publishView = (viewId: number) =>
  request<View>(`/views/${viewId}/publish`, { method: 'POST' });

export const setViewFavorite = (viewId: number, favorite: boolean) =>
  request<void>(`/views/${viewId}/favorite`, { method: favorite ? 'PUT' : 'DELETE' });

export const setViewHidden = (viewId: number, hidden: boolean) =>
  request<void>(`/views/${viewId}/hidden`, { method: hidden ? 'PUT' : 'DELETE' });

export const arrangeTabRow = (projectKey: string, orderedIds: number[]) =>
  request<View[]>(`/projects/${projectKey}/views/tab-row`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });

export const resetTabRow = (projectKey: string) =>
  request<View[]>(`/projects/${projectKey}/views/tab-row`, { method: 'DELETE' });

export const reorderViews = (projectKey: string, orderedIds: number[]) =>
  request<View[]>(`/projects/${projectKey}/views/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
