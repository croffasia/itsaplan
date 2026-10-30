import { request } from '@/lib/api/core/client';
import type { ActionDef } from '@/lib/api/endpoints/actions';
import type { Column } from '@/lib/api/endpoints/columns';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { Dashboard } from '@/lib/api/endpoints/dashboards';
import type { IssueTemplate } from '@/lib/api/endpoints/issueTemplates';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { Label, LabelGroup } from '@/lib/api/endpoints/labels';
import type { EstimateSettings, ProjectFeatures } from '@/lib/api/endpoints/settings';
import type { View } from '@/lib/api/endpoints/views';

// A saved copy of a project's configuration that new projects of the team start from.
export interface ProjectTemplate {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

// What a template holds. `sections` are the parts the hosted build adds, by the key of
// their copy option, with the names of what each holds.
export interface ProjectTemplateDetail extends ProjectTemplate {
  columns: Column[];
  issueTypes: IssueType[];
  labels: Label[];
  labelGroups: LabelGroup[];
  customFields: CustomField[];
  issueTemplates: IssueTemplate[];
  views: View[];
  dashboards: Dashboard[];
  actions: ActionDef[];
  features: ProjectFeatures;
  estimates: EstimateSettings;
  sections: { key: string; items: string[] }[];
}

export const getProjectTemplate = (teamId: number, templateId: number) =>
  request<ProjectTemplateDetail>(`/teams/${teamId}/project-templates/${templateId}`);

export const listProjectTemplates = (teamId: number) =>
  request<ProjectTemplate[]>(`/teams/${teamId}/project-templates`);

export const saveProjectTemplate = (
  teamId: number,
  input: {
    projectId: number;
    name: string;
    description?: string;
    include?: Record<string, boolean>;
  },
) =>
  request<ProjectTemplate>(`/teams/${teamId}/project-templates`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteProjectTemplate = (teamId: number, templateId: number) =>
  request<void>(`/teams/${teamId}/project-templates/${templateId}`, { method: 'DELETE' });
