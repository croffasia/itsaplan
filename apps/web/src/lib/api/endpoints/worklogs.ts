import { request } from '@/lib/api/core/client';

// One entry of the time a member logged on an issue: how long they worked, the day
// the work happened on, an optional note, and the member it belongs to. The time an
// issue took is the sum of its entries (Issue.loggedMinutes).
export interface Worklog {
  id: number;
  issueId: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  minutes: number;
  spentOn: string;
  note: string | null;
  createdAt: string;
}

// What a new entry carries. A change sends the same fields, any subset of them.
export interface WorklogInput {
  minutes: number;
  spentOn: string;
  note?: string | null;
}

// The time logged on an issue. Unlike the checklists these are not part of the
// issue read — it carries their sum, and only the section listing them needs the
// entries.
export const listWorklogs = (issueId: number) => request<Worklog[]>(`/issues/${issueId}/worklogs`);

export const createWorklog = (issueId: number, input: WorklogInput) =>
  request<Worklog>(`/issues/${issueId}/worklogs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateWorklog = (worklogId: number, patch: Partial<WorklogInput>) =>
  request<Worklog>(`/worklogs/${worklogId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteWorklog = (worklogId: number) =>
  request<void>(`/worklogs/${worklogId}`, { method: 'DELETE' });
