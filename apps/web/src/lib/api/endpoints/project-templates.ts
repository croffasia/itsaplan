import { request } from '@/lib/api/core/client';
import type { StateType } from '@/lib/api/endpoints/columns';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { EstimateSettings, ProjectFeatures } from '@/lib/api/endpoints/settings';

// A snapshot of a project's configuration that new projects of the workspace's teams start
// from. `teamIds` is null when every team of the workspace sees it.
export interface ProjectTemplate {
  id: number;
  name: string;
  description: string;
  teamIds: number[] | null;
  createdAt: string;
}

// What a template holds. Every entity keeps the id it had in the project the template was
// saved from, which is how the others reference it. `sections` are the parts the hosted
// build adds, by the key of their copy option, with the names of what each holds.
export interface TemplateContents {
  columns: {
    id: number;
    name: string;
    stateType: StateType;
    color: string;
    wipLimit: number | null;
    wipMode: 'soft' | 'hard';
  }[];
  issueTypes: { id: number; name: string; icon: string; color: string; isDefault: boolean }[];
  labelGroups: { id: number; name: string; color: string }[];
  labels: { id: number; groupId: number | null; name: string; color: string }[];
  customFields: {
    id: number;
    issueTypeId: number | null;
    name: string;
    fieldType: CustomField['fieldType'];
    memberScope: 'all' | 'humans' | 'agents' | null;
    showInBody: boolean;
    options: { id: number; value: string; color: string }[];
  }[];
  issueTemplates: {
    name: string;
    typeId: number | null;
    columnId: number | null;
    priority: string | null;
    labelIds: number[];
  }[];
  // The display, layout and effect blobs are the UI's own, as the views, dashboards and
  // actions store them.
  views: { name: string; display: unknown }[];
  dashboards: { name: string; layout: unknown }[];
  actions: { name: string; effect: unknown }[];
  settings: { key: string; value: unknown }[];
  features: ProjectFeatures;
  estimates: EstimateSettings;
  sections: { key: string; items: string[] }[];
}

export interface ProjectTemplateDetail extends ProjectTemplate, TemplateContents {}

// A template's page in the gallery at itsaplan.dev.
export interface TemplatePublication {
  url: string;
  publishedAt: string;
}

// A template as its workspace lists it, with its page in the gallery, null while it is
// not published.
export interface WorkspaceProjectTemplate extends ProjectTemplate {
  publication: TemplatePublication | null;
}

// The gallery address a workspace publishes under, and the author the gallery shows on
// every template from it. `authorName` is empty until someone names one.
export interface TemplatePublisher {
  email: string;
  authorName: string;
  authorUrl: string | null;
}

export const listTeamProjectTemplates = (teamId: number) =>
  request<ProjectTemplate[]>(`/teams/${teamId}/project-templates`);

export const getTeamProjectTemplate = (teamId: number, templateId: number) =>
  request<ProjectTemplateDetail>(`/teams/${teamId}/project-templates/${templateId}`);

export const listWorkspaceProjectTemplates = (workspaceId: number) =>
  request<WorkspaceProjectTemplate[]>(`/workspaces/${workspaceId}/project-templates`);

export const getWorkspaceProjectTemplate = (workspaceId: number, templateId: number) =>
  request<ProjectTemplateDetail>(`/workspaces/${workspaceId}/project-templates/${templateId}`);

// What a template saved from the project with this selection would hold.
export const previewProjectTemplate = (
  workspaceId: number,
  input: { projectId: number; include?: Record<string, boolean> },
) =>
  request<TemplateContents>(`/workspaces/${workspaceId}/project-templates/preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const saveProjectTemplate = (
  workspaceId: number,
  input: {
    projectId: number;
    name: string;
    description?: string;
    include?: Record<string, boolean>;
    teamIds?: number[];
  },
) =>
  request<ProjectTemplate>(`/workspaces/${workspaceId}/project-templates`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

// `teamIds` null opens the template to every team of the workspace.
export const updateProjectTemplate = (
  workspaceId: number,
  templateId: number,
  patch: { name?: string; description?: string; teamIds?: number[] | null },
) =>
  request<ProjectTemplate>(`/workspaces/${workspaceId}/project-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

// A template as another workspace imports it, on this instance or another one. The web
// app copies, saves and pastes it whole; the server checks it.
export interface SharedProjectTemplate {
  format: string;
  version: number;
  name: string;
  description: string;
  snapshot: unknown;
}

export const exportProjectTemplate = (workspaceId: number, templateId: number) =>
  request<SharedProjectTemplate>(
    `/workspaces/${workspaceId}/project-templates/${templateId}/export`,
  );

export const previewImportedTemplate = (workspaceId: number, template: SharedProjectTemplate) =>
  request<TemplateContents>(`/workspaces/${workspaceId}/project-templates/import/preview`, {
    method: 'POST',
    body: JSON.stringify({ template }),
  });

export const importProjectTemplate = (
  workspaceId: number,
  input: {
    template: SharedProjectTemplate;
    name: string;
    description?: string;
    teamIds?: number[];
  },
) =>
  request<ProjectTemplate>(`/workspaces/${workspaceId}/project-templates/import`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getTemplatePublisher = (workspaceId: number) =>
  request<{ publisher: TemplatePublisher | null }>(
    `/workspaces/${workspaceId}/template-publisher`,
  ).then((answer) => answer.publisher);

export const requestPublisherCode = (workspaceId: number, email: string) =>
  request<void>(`/workspaces/${workspaceId}/template-publisher/code`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const linkTemplatePublisher = (
  workspaceId: number,
  input: { email: string; code: string },
) =>
  request<TemplatePublisher>(`/workspaces/${workspaceId}/template-publisher`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const unlinkTemplatePublisher = (workspaceId: number) =>
  request<void>(`/workspaces/${workspaceId}/template-publisher`, { method: 'DELETE' });

export const setTemplatePublisherAuthor = (
  workspaceId: number,
  author: { authorName: string; authorUrl: string | null },
) =>
  request<TemplatePublisher>(`/workspaces/${workspaceId}/template-publisher/author`, {
    method: 'PUT',
    body: JSON.stringify(author),
  });

export const publishTemplate = (workspaceId: number, templateId: number) =>
  request<TemplatePublication>(
    `/workspaces/${workspaceId}/project-templates/${templateId}/publication`,
    { method: 'POST' },
  );

export const unpublishTemplate = (workspaceId: number, templateId: number) =>
  request<void>(`/workspaces/${workspaceId}/project-templates/${templateId}/publication`, {
    method: 'DELETE',
  });

export const deleteProjectTemplate = (workspaceId: number, templateId: number) =>
  request<void>(`/workspaces/${workspaceId}/project-templates/${templateId}`, {
    method: 'DELETE',
  });
