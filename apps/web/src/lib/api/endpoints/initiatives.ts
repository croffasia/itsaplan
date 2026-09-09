import { request } from '@/lib/api/core/client';
import type { ActivityPayload, FeedCursor } from '@/lib/api/endpoints/activity';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

export type InitiativeStatus = 'proposed' | 'planned' | 'active' | 'completed' | 'canceled';

export type InitiativeHealth = 'on_track' | 'at_risk' | 'off_track';

export interface InitiativeProgress {
  completed: number;
  canceled: number;
  total: number;
}

export interface Initiative {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: InitiativeStatus;
  ownerUserId: string | null;
  priority: string | null;
  startDate: string | null;
  targetDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  labelIds: number[];
  progress: InitiativeProgress;
  health: InitiativeHealth | null;
}

// An initiative as a picker option, for linking an issue to one.
export interface InitiativeOption {
  id: number;
  title: string;
  status: InitiativeStatus;
}

// Columns the initiative list can be sorted by, server-side. progress and health
// are derived and not sortable.
export const INITIATIVE_SORTS = ['title', 'priority', 'targetDate', 'owner'] as const;

export type InitiativeSort = (typeof INITIATIVE_SORTS)[number];

export interface InitiativeListParams extends PageParams {
  statuses?: string[];
  search?: string;
  sort?: InitiativeSort;
  dir?: 'asc' | 'desc';
}

// Per-status initiative counts for the list's status tabs.
export interface InitiativeCounts {
  total: number;
  proposed: number;
  planned: number;
  active: number;
  completed: number;
  canceled: number;
}

export interface NewInitiativeInput {
  title: string;
  description?: string;
  status?: InitiativeStatus;
  ownerUserId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  labelIds?: number[];
}

export interface InitiativePatch {
  title?: string;
  description?: string;
  status?: InitiativeStatus;
  ownerUserId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  labelIds?: number[];
}

// One entry in an initiative's feed: an event of the initiative itself (source
// 'initiative') or the activity of a linked issue (source 'issue', carrying the
// issue's id and identifier so the row can link to it).
export interface InitiativeFeedItem {
  id: number;
  source: 'initiative' | 'issue';
  kind: 'comment' | 'activity';
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  payload: ActivityPayload;
  createdAt: string;
  issueId: number | null;
  issueIdentifier: string | null;
}

export interface InitiativeFeedPage {
  items: InitiativeFeedItem[];
  nextCursor: FeedCursor | null;
}

// Initiatives — collection ops take projectKey; ops on one initiative take its
// own id and hit /initiatives/:id (like issues).
export const listInitiatives = (projectKey: string, params: InitiativeListParams) =>
  request<Page<Initiative>>(
    `/projects/${projectKey}/initiatives${pageQuery(params, {
      status: params.statuses?.join(','),
      search: params.search,
      sort: params.sort,
      dir: params.dir,
    })}`,
  );

export const listInitiativeOptions = (
  projectKey: string,
  params: { search?: string; include?: number },
) => {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.include) q.set('include', String(params.include));
  const qs = q.toString();
  return request<InitiativeOption[]>(
    `/projects/${projectKey}/initiatives/options${qs ? `?${qs}` : ''}`,
  );
};

export const initiativeCounts = (projectKey: string) =>
  request<InitiativeCounts>(`/projects/${projectKey}/initiatives/counts`);

export const getInitiative = (id: number) => request<Initiative>(`/initiatives/${id}`);

export const createInitiative = (projectKey: string, input: NewInitiativeInput) =>
  request<Initiative>(`/projects/${projectKey}/initiatives`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateInitiative = (id: number, patch: InitiativePatch) =>
  request<Initiative>(`/initiatives/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteInitiative = (id: number) =>
  request<void>(`/initiatives/${id}`, { method: 'DELETE' });

export const listInitiativeFeed = (
  id: number,
  params: { cursor?: FeedCursor | null; limit?: number } = {},
) => {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
  const qs = q.toString();
  return request<InitiativeFeedPage>(`/initiatives/${id}/feed${qs ? `?${qs}` : ''}`);
};
