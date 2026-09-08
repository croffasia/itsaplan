import { request } from '@/lib/api/core/client';

// A preset a new issue can be created from: the title and description it starts
// with plus the properties applied on top of them. A property left null presets
// nothing — the create dialog keeps its own default for it.
export interface IssueTemplate {
  id: number;
  name: string;
  description: string;
  titleTemplate: string;
  descriptionTemplate: string;
  typeId: number | null;
  columnId: number | null;
  priority: string | null;
  assigneeUserId: string | null;
  labelIds: number[];
}

export interface NewIssueTemplateInput {
  name: string;
  description?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  typeId?: number | null;
  columnId?: number | null;
  priority?: string | null;
  assigneeUserId?: string | null;
  labelIds?: number[];
}

// A property left out keeps its value; `labelIds` replaces the whole label set.
export type IssueTemplatePatch = Partial<NewIssueTemplateInput>;

export const createIssueTemplate = (projectKey: string, input: NewIssueTemplateInput) =>
  request<IssueTemplate>(`/projects/${projectKey}/issue-templates`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateIssueTemplate = (
  projectKey: string,
  templateId: number,
  patch: IssueTemplatePatch,
) =>
  request<IssueTemplate>(`/projects/${projectKey}/issue-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteIssueTemplate = (projectKey: string, templateId: number) =>
  request<void>(`/projects/${projectKey}/issue-templates/${templateId}`, { method: 'DELETE' });
