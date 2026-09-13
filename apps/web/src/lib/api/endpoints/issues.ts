import type { CycleStatus } from '@/lib/api/endpoints/cycles';
import type { InitiativeStatus } from '@/lib/api/endpoints/initiatives';
import { request } from '@/lib/api/core/client';
import type { Checklist } from '@/lib/api/endpoints/checklists';
import type { CustomFieldType } from '@/lib/api/endpoints/customFields';
import type { DevelopmentLink } from '@/lib/api/endpoints/git';

// The subtask disposition as the delete route takes it: a query string, since a
// DELETE carries no body.
function subtaskQuery(disposition?: SubtaskDisposition): string {
  if (!disposition) return '';
  const qs = new URLSearchParams({ subtasks: disposition.subtasks });
  if (disposition.newParentId != null) qs.set('newParentId', String(disposition.newParentId));
  return `?${qs.toString()}`;
}

// One custom field value on a project issue: the scalar value (null for
// select/multi_select and unset fields), the end of a datetime_range, and the
// selected option ids. Only fields with a value set appear; unset fields are
// omitted (see listIssues).
export interface IssueFieldValueEntry {
  fieldId: number;
  value: string | number | boolean | null;
  valueEnd: string | null;
  optionIds: number[];
}

export interface Issue {
  id: number;
  projectId: number;
  // Project-scoped sequence number (the "42" in "MKT-42"). Addresses the issue by
  // its human number in URLs (/project/MKT/issue/42).
  sequenceNumber: number;
  identifier: string;
  typeId: number | null;
  // The initiative this issue is linked to, expanded to id + title for rendering,
  // or null. Set through updateIssue by initiativeId.
  initiative: InitiativeRef | null;
  // The cycle this issue is planned into, expanded to id + name for rendering, or
  // null. Set through updateIssue by cycleId.
  cycle: CycleRef | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  columnId: number;
  // The issue this one is a subtask of, or null when it stands on its own. The
  // views render a subtask under its parent instead of on its own, so an issue
  // with a parent never shows as a card or a row of its own.
  parentId: number | null;
  title: string;
  description: string;
  priority: string | null;
  // Time is in minutes; the UI enters and shows it as hours and minutes.
  estimatePoints: number | null;
  estimateMinutes: number | null;
  // The sum of the issue's logged time entries, 0 when nothing was logged. The
  // entries themselves are read separately (listWorklogs).
  loggedMinutes: number;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  // When the issue was archived (hidden from the board but kept), or null when it
  // is active. Set by the archive action or the worker's auto-archive sweep.
  archivedAt: string | null;
  // When the issue entered its current column (or createdAt if it never moved).
  // Drives the "time in current status" badge.
  statusSince: string;
  // Unguessable token for the public read-only share link, or null when not shared.
  shareToken: string | null;
  // Whether that link exposes the issue in full (assignees, labels, custom fields,
  // activity) or only its title, description, state, type, priority, dates,
  // subtasks and links.
  shareExtended: boolean;
  labelIds: number[];
  fieldValues: IssueFieldValueEntry[];
}

// A light search result from GET /projects/:key/issues/search: enough to list and
// open a match, without the full issue's description or field values.
export interface IssueSearchHit {
  id: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  columnId: number;
  typeId: number | null;
  initiativeId: number | null;
  cycleId: number | null;
  parentId: number | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  priority: string | null;
  dueDate: string | null;
  labelIds: number[];
  archived: boolean;
}

export interface IssueFieldValue {
  fieldId: number;
  name: string;
  fieldType: CustomFieldType;
  value: string | number | boolean | null;
  valueEnd: string | null;
  optionIds: number[];
}

// A custom field value on the way in (setFieldValue). `value` carries the
// scalar types, `valueEnd` the end of a datetime_range, `optionIds` the
// select/multi_select ones; a field uses one or the other.
export interface IssueFieldValueInput {
  value?: string | number | boolean | null;
  valueEnd?: string | null;
  optionIds?: number[];
}

// How an issue carries the initiative and the cycle it belongs to: the id plus
// what to render, and the initiative status the board orders its lanes by. The
// picker lists are InitiativeOption / CycleOption.
export interface InitiativeRef {
  id: number;
  title: string;
  status: InitiativeStatus;
}

// One cycle an issue was in. The cycle history of an issue is a list of these,
// oldest first.
export interface IssueCycleEntry {
  cycleId: number;
  name: string;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  enteredAt: string;
  leftAt: string | null;
}

export interface CycleRef {
  id: number;
  name: string;
  status: CycleStatus;
}

// An issue as a board carries it: with its relations to the project's other active
// issues. The board payload and the public share bundle have them; a write response
// returns a plain Issue.
export interface BoardIssue extends Issue {
  links: IssueLinkRef[];
  // How many subtasks the issue has, archived ones included. The board carries
  // only active issues, so an archived subtask shows up nowhere else — and a
  // delete or an archive still has to ask about it.
  subtaskCount: number;
}

export interface BoardIssues {
  issues: BoardIssue[];
}

export interface IssueDetail extends Issue {
  fields: IssueFieldValue[];
}

// A relation between two issues (mirrors apps/api modules/issues/links.ts). 'blocks' and
// 'duplicates' are directional and read differently on each end, which direction
// selects: 'outward' is the side that blocks/duplicates, 'inward' the side that is
// blocked/duplicated. On a symmetric 'relates' relation direction means nothing.
export type IssueLinkKind = 'blocks' | 'relates' | 'duplicates';

export type IssueLinkDirection = 'outward' | 'inward';

// What linkIssues accepts: the stored kinds plus the inverse reading of the two
// directional ones, so a relation can be stated from either end.
export type IssueLinkInputKind = IssueLinkKind | 'blocked_by' | 'duplicated_by';

export interface IssueLink {
  id: number;
  kind: IssueLinkKind;
  direction: IssueLinkDirection;
  // The issue on the other end of the relation.
  issue: IssueRef;
}

// One of an issue's relations as the board payload carries it: how the relation
// reads from this issue, and the id of the issue on the other end. Both ends
// carry it, each with its own reading; the views name the other end by looking
// the id up among the board's issues, which is why a relation to an archived
// issue is not sent.
export interface IssueLinkRef {
  id: number;
  relation: IssueLinkInputKind;
  issueId: number;
}

// A member following an issue: they receive every notification it produces.
export interface IssueWatcher {
  userId: string;
  name: string;
  image: string | null;
}

// Another issue named with the state it is in: an issue's parent, one of its
// subtasks, or the other end of a relation.
export interface IssueRef {
  id: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  columnId: number;
  typeId: number | null;
  archived: boolean;
}

// What a delete or an archive does with the issue's subtasks: they follow it
// (deleted with a delete, archived with an archive), they are detached into
// ordinary issues, or they move to another parent. Required whenever the issue
// being removed has subtasks.
export type SubtaskMode = 'cascade' | 'detach' | 'reassign';

export interface SubtaskDisposition {
  subtasks: SubtaskMode;
  newParentId?: number;
}

// The issue with its relations and its place in the subtask hierarchy. Shared
// pages carry this much; the detail routes add the watchers and the checklists,
// neither of which a public page exposes.
export interface IssueRelations extends IssueDetail {
  links: IssueLink[];
  parent: IssueRef | null;
  subtasks: IssueRef[];
}

// The issue as the detail routes return it.
export interface IssueWithWatchers extends IssueRelations {
  watchers: IssueWatcher[];
  checklists: Checklist[];
  development: DevelopmentLink[];
}

export interface NewIssueInput {
  typeId?: number | null;
  initiativeId?: number | null;
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  columnId: number;
  parentId?: number | null;
  title: string;
  description?: string;
  priority?: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  labelIds?: number[];
}

// The fields a bulk update can set on many issues at once (the board-relevant
// subset of IssuePatch: no title/description/position).
export interface BulkIssuePatch {
  columnId?: number;
  typeId?: number | null;
  initiativeId?: number | null;
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  priority?: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface IssuePatch {
  columnId?: number;
  position?: number;
  typeId?: number | null;
  parentId?: number | null;
  initiativeId?: number | null;
  cycleId?: number | null;
  assigneeUserId?: string | null;
  delegateUserId?: string | null;
  title?: string;
  description?: string;
  priority?: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  labelIds?: number[];
}

export const createIssue = (projectKey: string, input: NewIssueInput) =>
  request<Issue>(`/projects/${projectKey}/issues`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getIssue = (id: number, signal?: AbortSignal) =>
  request<IssueWithWatchers>(`/issues/${id}`, { signal });

// Resolve an issue by its project-scoped number (the human "42" in the URL).
export const getIssueBySeq = (projectKey: string, seq: number, signal?: AbortSignal) =>
  request<IssueWithWatchers>(`/projects/${encodeURIComponent(projectKey)}/issues/${seq}`, {
    signal,
  });

export const listIssueCycles = (id: number) => request<IssueCycleEntry[]>(`/issues/${id}/cycles`);

export const updateIssue = (id: number, patch: IssuePatch) =>
  request<Issue>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

// An issue that has subtasks needs a disposition saying what happens to them;
// without one the server rejects the delete with a 409.
export const deleteIssue = (id: number, subtasks?: SubtaskDisposition) =>
  request<void>(`/issues/${id}${subtaskQuery(subtasks)}`, { method: 'DELETE' });

// Board multi-select: apply one change to many issues in a single request. The
// server filters the ids to the project and refetching happens once.
export const bulkUpdateIssues = (projectKey: string, ids: number[], patch: BulkIssuePatch) =>
  request<{ updated: number }>(`/projects/${projectKey}/issues/bulk`, {
    method: 'PATCH',
    body: JSON.stringify({ ids, patch }),
  });

export const bulkAddLabels = (projectKey: string, ids: number[], add: number[]) =>
  request<{ updated: number }>(`/projects/${projectKey}/issues/bulk/labels`, {
    method: 'POST',
    body: JSON.stringify({ ids, add }),
  });

export const bulkArchiveIssues = (
  projectKey: string,
  ids: number[],
  subtasks?: SubtaskDisposition,
) =>
  request<{ archived: number }>(`/projects/${projectKey}/issues/bulk/archive`, {
    method: 'POST',
    body: JSON.stringify({ ids, ...subtasks }),
  });

export const bulkDeleteIssues = (
  projectKey: string,
  ids: number[],
  subtasks?: SubtaskDisposition,
) =>
  request<{ deleted: number }>(`/projects/${projectKey}/issues/bulk/delete`, {
    method: 'POST',
    body: JSON.stringify({ ids, ...subtasks }),
  });

// Archive/restore: hide an issue from the board (kept, restorable) or bring it
// back. The board excludes archived issues; the archive settings section lists them.
export const archiveIssue = (id: number, subtasks?: SubtaskDisposition) =>
  request<Issue>(`/issues/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify(subtasks ?? {}),
  });

export const restoreIssue = (id: number) =>
  request<Issue>(`/issues/${id}/restore`, { method: 'POST' });

// Server-side text search for the command palette. Always returns all matches,
// archived included (each hit carries an `archived` flag).
export const searchIssues = (projectKey: string, params: { q?: string; limit?: number }) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.limit != null) qs.set('limit', String(params.limit));
  return request<IssueSearchHit[]>(`/projects/${projectKey}/issues/search?${qs.toString()}`);
};

// Relations between issues. The relation reads from the issue in the path: it
// blocks / relates to / duplicates targetIssueId. Both ends show it.
export const linkIssues = (issueId: number, targetIssueId: number, kind: IssueLinkInputKind) =>
  request<IssueLink>(`/issues/${issueId}/links`, {
    method: 'POST',
    body: JSON.stringify({ targetIssueId, kind }),
  });

export const unlinkIssues = (issueId: number, linkId: number) =>
  request<void>(`/issues/${issueId}/links/${linkId}`, { method: 'DELETE' });

// Following an issue. The singular routes act on the signed-in user; the
// watcher routes let an editor curate other project members. Every route
// returns the resulting watcher list.
export const watchIssue = (issueId: number) =>
  request<IssueWatcher[]>(`/issues/${issueId}/watch`, { method: 'POST' });

export const unwatchIssue = (issueId: number) =>
  request<IssueWatcher[]>(`/issues/${issueId}/watch`, { method: 'DELETE' });

export const addIssueWatcher = (issueId: number, userId: string) =>
  request<IssueWatcher[]>(`/issues/${issueId}/watchers/${userId}`, { method: 'PUT' });

export const removeIssueWatcher = (issueId: number, userId: string) =>
  request<IssueWatcher[]>(`/issues/${issueId}/watchers/${userId}`, { method: 'DELETE' });

export const setFieldValue = (issueId: number, fieldId: number, input: IssueFieldValueInput) =>
  request<{ ok: boolean }>(`/issues/${issueId}/fields/${fieldId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
