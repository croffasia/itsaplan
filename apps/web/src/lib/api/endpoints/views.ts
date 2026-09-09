import type { FilterSet } from '@/utils/filters';
import type { SavedViewDisplay } from '@/utils/viewSettings';
import { request } from '@/lib/api/core/client';

// A saved view (a tab above the work items view): a named filter set plus a display
// snapshot (layout + that layout's settings). The view itself is shared by the
// project; only `favorite` is per user. filters/display are stored as jsonb.
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
  // Whether the current user marked the view as a favorite: it pins the tab to the
  // front and lists the view under Work items in the sidebar.
  favorite: boolean;
  createdAt: string;
}

export interface NewViewInput {
  name: string;
  icon?: string | null;
  filters?: FilterSet;
  display?: SavedViewDisplay;
}

export interface ViewPatch {
  name?: string;
  icon?: string | null;
  filters?: FilterSet;
  display?: SavedViewDisplay;
}

export const listViews = (projectKey: string) => request<View[]>(`/projects/${projectKey}/views`);

export const createView = (projectKey: string, input: NewViewInput) =>
  request<View>(`/projects/${projectKey}/views`, { method: 'POST', body: JSON.stringify(input) });

export const updateView = (viewId: number, patch: ViewPatch) =>
  request<View>(`/views/${viewId}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteView = (viewId: number) =>
  request<void>(`/views/${viewId}`, { method: 'DELETE' });

export const setViewFavorite = (viewId: number, favorite: boolean) =>
  request<void>(`/views/${viewId}/favorite`, { method: favorite ? 'PUT' : 'DELETE' });

export const reorderViews = (projectKey: string, orderedIds: number[]) =>
  request<View[]>(`/projects/${projectKey}/views/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
