import { request, uploadFile } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';
import type { Issue } from '@/lib/api/endpoints/issues';

export type IntakeStatus = 'pending' | 'snoozed' | 'accepted' | 'declined' | 'duplicate';

export interface LinkedIssueSummary {
  id: number;
  sequenceNumber: number;
  title: string;
}

export interface IntakeAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export interface IntakeComment {
  id: number;
  intakeRequestId: number;
  actorUserId: string | null;
  actorName: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeRequest {
  id: number;
  projectId: number;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | null;
  status: IntakeStatus;
  source: string;
  externalId: string | null;
  submittedByUserId: string | null;
  submittedByName: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  declineReason: string | null;
  snoozedUntil: string | null;
  acceptedIssueId: number | null;
  acceptedIssue: LinkedIssueSummary | null;
  duplicateOfIssueId: number | null;
  duplicateOfIssue: LinkedIssueSummary | null;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeRequestDetail extends IntakeRequest {
  comments: IntakeComment[];
  attachments: IntakeAttachment[];
}

export interface IntakeSummary {
  pendingCount: number;
  snoozedCount: number;
  acceptedCount: number;
  declinedCount: number;
  duplicateCount: number;
  oldestPendingAt: string | null;
  oldestPendingAgeMs: number | null;
}

export interface ListIntakeParams extends PageParams {
  status?: IntakeStatus | 'all';
  source?: string;
  externalId?: string;
  q?: string;
}

export interface CreateIntakeInput {
  title: string;
  description?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low' | null;
  source?: string;
  externalId?: string | null;
}

export interface AcceptIntakeInput {
  assigneeUserId?: string | null;
  dueDate?: string | null;
  columnId?: number;
  typeId?: number | null;
  priority?: 'urgent' | 'high' | 'medium' | 'low' | null;
}

export const listIntakeRequests = (projectKey: string, params: ListIntakeParams) =>
  request<Page<IntakeRequest>>(
    `/projects/${projectKey}/intake${pageQuery(params, {
      status: params.status,
      source: params.source,
      externalId: params.externalId,
      q: params.q,
    })}`,
  );

export const getIntakeSummary = (projectKey: string) =>
  request<IntakeSummary>(`/projects/${projectKey}/intake/summary`);

export const getIntakeRequest = (requestId: number) =>
  request<IntakeRequestDetail>(`/intake/${requestId}`);

export const createIntakeRequest = (projectKey: string, input: CreateIntakeInput) =>
  request<IntakeRequest>(`/projects/${projectKey}/intake`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const acceptIntakeRequest = (requestId: number, input: AcceptIntakeInput = {}) =>
  request<{ request: IntakeRequest; issue: Issue }>(`/intake/${requestId}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const declineIntakeRequest = (requestId: number, reason?: string | null) =>
  request<IntakeRequest>(`/intake/${requestId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || null }),
  });

export const snoozeIntakeRequest = (requestId: number, until: string) =>
  request<IntakeRequest>(`/intake/${requestId}/snooze`, {
    method: 'POST',
    body: JSON.stringify({ until }),
  });

export const markIntakeDuplicate = (requestId: number, issueId: number) =>
  request<IntakeRequest>(`/intake/${requestId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ issueId }),
  });

export const deleteIntakeRequest = (requestId: number) =>
  request<void>(`/intake/${requestId}`, { method: 'DELETE' });

export const createIntakeComment = (requestId: number, body: string) =>
  request<IntakeComment>(`/intake/${requestId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

export const uploadIntakeAttachment = (requestId: number, file: File) =>
  uploadFile<IntakeAttachment>(`/intake/${requestId}/attachments`, 'POST', file);
