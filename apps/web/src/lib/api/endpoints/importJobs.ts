import { request } from '@/lib/api/core/client';

// Import jobs bring issues in from a source Plane instance (mirrors apps/api
// modules/import-jobs/service.ts). Creating one stores an encrypted credential
// and leaves the job 'pending' for the worker to drive through its phases.

export type ImportJobPhase = 'discover' | 'create' | 'link' | 'rewrite' | 'attachments' | 'done';
export type ImportJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export type ImportEntityType = 'issue' | 'comment' | 'label' | 'state' | 'cycle' | 'attachment';

export interface ImportEntityCount {
  discovered: number;
  created: number;
}

export interface ImportJob {
  id: number;
  projectId: number;
  source: 'plane';
  phase: ImportJobPhase;
  status: ImportJobStatus;
  counts: Record<ImportEntityType, ImportEntityCount>;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaneProjectOption {
  id: string;
  name: string;
  identifier: string;
}

export type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
export type UnmatchedUserPolicy = 'unassigned' | 'skip';

export interface PlaneStateOption {
  id: string;
  name: string;
  category: StateCategory;
}

export interface PlaneConnectionInput {
  baseUrl: string;
  workspaceSlug: string;
  apiToken: string;
}

export interface CreateImportJobInput extends PlaneConnectionInput {
  planeProjectId: string;
  planeProjectKey: string;
  unmatchedUserPolicy?: UnmatchedUserPolicy;
  stateOverrides?: Record<string, StateCategory>;
}

export const testPlaneConnection = (projectKey: string, input: PlaneConnectionInput) =>
  request<{ projects: PlaneProjectOption[] }>(
    `/projects/${projectKey}/import-jobs/test-connection`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const testPlaneStatesPreview = (
  projectKey: string,
  input: PlaneConnectionInput & { planeProjectId: string },
) =>
  request<{ states: PlaneStateOption[] }>(`/projects/${projectKey}/import-jobs/plane-preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const createImportJob = (projectKey: string, input: CreateImportJobInput) =>
  request<ImportJob>(`/projects/${projectKey}/import-jobs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const listImportJobs = (projectKey: string) =>
  request<ImportJob[]>(`/projects/${projectKey}/import-jobs`);

export const pauseImportJob = (id: number) =>
  request<ImportJob>(`/import-jobs/${id}/pause`, { method: 'POST' });

export const resumeImportJob = (id: number) =>
  request<ImportJob>(`/import-jobs/${id}/resume`, { method: 'POST' });

export const cancelImportJob = (id: number) =>
  request<ImportJob>(`/import-jobs/${id}/cancel`, { method: 'POST' });

export interface ExportedComment {
  authorName: string | null;
  authorEmail: string | null;
  body: string;
  createdAt: string;
  replyToIndex: number | null;
}

export interface ExportedRelation {
  kind: string;
  targetIdentifier: string;
}

export interface ExportedIssue {
  identifier: string;
  title: string;
  description: string;
  state: string;
  labels: string[];
  cycle: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  parentIdentifier: string | null;
  assigneeEmail: string | null;
  comments: ExportedComment[];
  relations: ExportedRelation[];
}

// A self-contained snapshot of a project's data - states, labels, cycles, and issues
// (with their comments and relations) - as portable JSON. Not a live sync to any
// target, a download; mirrors apps/api's ProjectExportResponse.
export interface ProjectExport {
  exportedAt: string;
  project: { key: string; name: string; description: string };
  states: { name: string; category: string }[];
  labels: { name: string; color: string }[];
  cycles: { name: string; startDate: string; endDate: string; goal: string }[];
  issues: ExportedIssue[];
}

export const exportProject = (projectKey: string) =>
  request<ProjectExport>(`/projects/${projectKey}/import-jobs/export`);
