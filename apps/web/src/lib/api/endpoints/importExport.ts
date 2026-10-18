import { request, uploadFile } from '@/lib/api/core/client';

// Import jobs bring issues in from a Plane instance, a Linear workspace, a Jira
// Cloud site, a Trello board, a Procore project or an uploaded MS Project file (mirrors apps/api modules/import-export). Creating one stores an
// encrypted credential and leaves the job 'pending' for the worker to drive through
// its phases.

export type ImportJobPhase = 'discover' | 'create' | 'link' | 'rewrite' | 'attachments' | 'done';
export type ImportJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export type ImportEntityType = 'issue' | 'comment' | 'label' | 'state' | 'cycle' | 'attachment';
export type ImportSource = 'plane' | 'linear' | 'jira' | 'trello' | 'procore' | 'msproject';

export interface ImportEntityCount {
  discovered: number;
  created: number;
}

export interface ImportJob {
  id: number;
  projectId: number;
  source: ImportSource;
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

export interface LinearProjectOption {
  id: string;
  name: string;
}

export interface LinearTeamOption {
  id: string;
  key: string;
  name: string;
  projects: LinearProjectOption[];
}

export interface LinearConnectionInput {
  apiToken: string;
}

export interface ImportJobChoices {
  unmatchedUserPolicy?: UnmatchedUserPolicy;
  stateOverrides?: Record<string, StateCategory>;
}

export interface PlaneImportJobFields extends PlaneConnectionInput {
  source: 'plane';
  planeProjectId: string;
  planeProjectKey: string;
}

export interface LinearImportJobFields extends LinearConnectionInput {
  source: 'linear';
  teamId: string;
  teamKey: string;
  projectFilter: 'project' | 'none';
  projectId?: string;
}

export interface JiraConnectionInput {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraProjectOption {
  id: string;
  key: string;
  name: string;
}

export interface JiraImportJobFields extends JiraConnectionInput {
  source: 'jira';
  jiraProjectKey: string;
}

export interface TrelloConnectionInput {
  apiKey: string;
  token: string;
}

export interface TrelloBoardOption {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloImportJobFields extends TrelloConnectionInput {
  source: 'trello';
  trelloBoardId: string;
}

export type ProcoreTool = 'punch_items' | 'rfis';

export interface ProcoreConnectionInput {
  clientId: string;
  clientSecret: string;
  companyId: string;
  sandbox: boolean;
}

export interface ProcoreProjectOption {
  id: string;
  name: string;
}

export interface ProcoreImportJobFields extends ProcoreConnectionInput {
  source: 'procore';
  procoreProjectId: string;
  procoreTool: ProcoreTool;
}

export interface MsProjectUpload {
  fileKey: string;
  fileName: string;
  taskCount: number;
  states: PlaneStateOption[];
}

export interface MsProjectImportJobFields {
  source: 'msproject';
  msprojectFileKey: string;
  msprojectName: string;
}

export type CreateImportJobInput = ImportJobChoices &
  (
    | PlaneImportJobFields
    | LinearImportJobFields
    | JiraImportJobFields
    | TrelloImportJobFields
    | ProcoreImportJobFields
    | MsProjectImportJobFields
  );

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

export const testLinearConnection = (projectKey: string, input: LinearConnectionInput) =>
  request<{ teams: LinearTeamOption[] }>(
    `/projects/${projectKey}/import-jobs/linear-test-connection`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const testLinearStatesPreview = (
  projectKey: string,
  input: LinearConnectionInput & { teamId: string },
) =>
  request<{ states: PlaneStateOption[] }>(`/projects/${projectKey}/import-jobs/linear-preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const testJiraConnection = (projectKey: string, input: JiraConnectionInput) =>
  request<{ projects: JiraProjectOption[] }>(
    `/projects/${projectKey}/import-jobs/jira-test-connection`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const testJiraStatesPreview = (
  projectKey: string,
  input: JiraConnectionInput & { jiraProjectKey: string },
) =>
  request<{ states: PlaneStateOption[] }>(`/projects/${projectKey}/import-jobs/jira-preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const testTrelloConnection = (projectKey: string, input: TrelloConnectionInput) =>
  request<{ boards: TrelloBoardOption[] }>(
    `/projects/${projectKey}/import-jobs/trello-test-connection`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const testTrelloStatesPreview = (
  projectKey: string,
  input: TrelloConnectionInput & { trelloBoardId: string },
) =>
  request<{ states: PlaneStateOption[] }>(`/projects/${projectKey}/import-jobs/trello-preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const testProcoreConnection = (projectKey: string, input: ProcoreConnectionInput) =>
  request<{ projects: ProcoreProjectOption[] }>(
    `/projects/${projectKey}/import-jobs/procore-test-connection`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const testProcoreStatesPreview = (
  projectKey: string,
  input: ProcoreConnectionInput & { procoreProjectId: string; procoreTool: ProcoreTool },
) =>
  request<{ states: PlaneStateOption[] }>(`/projects/${projectKey}/import-jobs/procore-preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const uploadMsProjectFile = (projectKey: string, file: File) =>
  uploadFile<MsProjectUpload>(`/projects/${projectKey}/import-jobs/msproject-upload`, 'POST', file);

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
