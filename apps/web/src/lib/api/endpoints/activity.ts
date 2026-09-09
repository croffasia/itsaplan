import { request } from '@/lib/api/core/client';

// The query string both feed reads take, empty for the first page.
function feedPageQuery(params: { cursor?: FeedCursor | null; limit?: number }): string {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export interface ActivityItem {
  id: number;
  issueId: number;
  issueSequence: number;
  issueTitle: string;
  kind: 'comment' | 'activity';
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: ActivityAction | null;
  payload: ActivityPayload;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: FeedCursor | null;
}

// `action` selects how the UI renders an activity row; the payload carries what
// changed (see ActivityPayload).
export type ActivityAction =
  | 'created'
  | 'title'
  | 'description'
  | 'status'
  | 'assignee'
  | 'delegate'
  | 'priority'
  | 'estimate'
  | 'type'
  | 'cycle'
  | 'start_date'
  | 'due_date'
  | 'label_add'
  | 'label_remove'
  | 'link_add'
  | 'link_remove'
  | 'parent'
  | 'subtask_add'
  | 'subtask_remove'
  | 'checklist_add'
  | 'checklist_rename'
  | 'checklist_remove'
  | 'checklist_item_add'
  | 'checklist_item_remove'
  | 'worklog'
  | 'field'
  | 'archived'
  | 'restored'
  | 'git_pr'
  // Entries recorded before the integration took other providers.
  | 'github_pr'
  | 'agent_started'
  | 'agent_finished'
  | 'comment_edited'
  | 'comment_deleted';

// One side of a change: the display-ready text snapshot (column/label/type/assignee
// name, raw priority, ISO date, or the new text of a long field) and the id of the
// row behind it when the side names one. A status side also carries the state type
// its column had at the time, a pull request its repository and number.
export interface ActivitySide {
  value: string | null;
  id?: number | string | null;
  stateType?: string | null;
  repo?: string;
  number?: number;
  // A 'worklog' side carries the day its time was spent on.
  date?: string | null;
}

// What an activity row says changed. `subject` names the sub-item where the action
// alone is not enough (the custom field for 'field', the checklist of an item, the
// relation of a link); `from` and `to` are the two sides of the change. A side the
// action does not have is absent.
export interface ActivityPayload {
  subject?: ActivitySide;
  from?: ActivitySide;
  to?: ActivitySide;
}

// One entry in an issue's timeline. kind selects which fields are set: a 'comment'
// carries body; an 'activity' carries action and payload.
// actorName is the author/actor snapshot (null when it was never set).
export interface FeedItem {
  id: number;
  issueId: number;
  kind: 'comment' | 'activity';
  // The comment this one replies to, null for a top-level entry.
  replyToId: number | null;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: ActivityAction | null;
  payload: ActivityPayload;
  createdAt: string;
  // Set once a comment is edited; null while it is in its author's original words.
  editedAt: string | null;
}

// Opaque keyset cursor returned by the feed endpoint; pass it back to load the
// next (older) page.
export interface FeedCursor {
  ts: string;
  id: number;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
}

// One stretch of the grouped feed: the status the issue was in, and the entries of
// this page written while it was there. `to` is null for the stretch it is in now,
// and `repeat` marks a status the issue had already been in earlier.
export interface FeedGroup {
  status: string | null;
  from: string;
  to: string | null;
  durationMs: number;
  repeat: boolean;
  items: FeedItem[];
}

// A page of the feed split into stretches. Paged by the same cursor as FeedPage, so a
// stretch that spans a page boundary arrives in both, each time with that page's
// entries.
export interface GroupedFeedPage {
  groups: FeedGroup[];
  nextCursor: FeedCursor | null;
}

// One stretch the issue spent in a single column. `status` is the column under the
// name it carries now, falling back to the name it had at the time once it is
// deleted (null only when the stretch recorded none); `to` is null for the stretch
// the issue is in now. The entries written inside a stretch are a separate read
// (listTimelineItems), made when one is opened.
export interface TimelineSegment {
  status: string | null;
  from: string;
  to: string | null;
  durationMs: number;
}

export const listFeed = (
  issueId: number,
  params: { cursor?: FeedCursor | null; limit?: number } = {},
) => request<FeedPage>(`/issues/${issueId}/feed${feedPageQuery(params)}`);

// The same page, split into the stretches the issue spent in one status.
export const listGroupedFeed = (
  issueId: number,
  params: { cursor?: FeedCursor | null; limit?: number } = {},
) => request<GroupedFeedPage>(`/issues/${issueId}/feed/grouped${feedPageQuery(params)}`);

export const listTimeline = (issueId: number) =>
  request<TimelineSegment[]>(`/issues/${issueId}/timeline`);

// The entries of one stretch of the timeline: [from, to), open-ended without `to`.
export const listTimelineItems = (issueId: number, from: string, to: string | null) => {
  const q = new URLSearchParams({ from });
  if (to) q.set('to', to);
  return request<FeedItem[]>(`/issues/${issueId}/timeline/items?${q.toString()}`);
};

export const createComment = (issueId: number, input: { body: string; replyToId?: number }) =>
  request<FeedItem>(`/issues/${issueId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateComment = (commentId: number, input: { body: string }) =>
  request<FeedItem>(`/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteComment = (commentId: number) =>
  request<void>(`/comments/${commentId}`, { method: 'DELETE' });
