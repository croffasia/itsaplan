import { request } from '@/lib/api/core/client';

// Import jobs bring issues in from a source Plane instance (mirrors apps/api
// modules/import-jobs/service.ts). Creating one stores an encrypted credential
// and leaves the job 'pending' for the worker to drive through its phases.

export type ImportJobPhase = 'discover' | 'create' | 'link' | 'attachments' | 'done';
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

export interface PlaneConnectionInput {
  baseUrl: string;
  workspaceSlug: string;
  apiToken: string;
}

export interface CreateImportJobInput extends PlaneConnectionInput {
  planeProjectId: string;
}

export const testPlaneConnection = (projectKey: string, input: PlaneConnectionInput) =>
  request<{ projects: PlaneProjectOption[] }>(
    `/projects/${projectKey}/import-jobs/test-connection`,
    { method: 'POST', body: JSON.stringify(input) },
  );

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
