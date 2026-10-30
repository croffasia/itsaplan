import { t } from 'elysia';
import {
  copyInclude,
  EstimatesResponse,
  FeaturesResponse,
  PROJECT_DESCRIPTION_LIMIT,
} from '#modules/projects/model';
import { ColumnResponse } from '#modules/columns/model';
import { IssueTypeResponse } from '#modules/issue-types/model';
import { LabelGroupResponse, LabelResponse } from '#modules/labels/model';
import { CustomFieldResponse } from '#modules/custom-fields/model';
import { IssueTemplateListResponse } from '#modules/issue-templates/model';
import { ViewResponse } from '#modules/views/model';
import { DashboardListResponse } from '#modules/dashboards/model';
import { ActionListResponse } from '#modules/actions/model';

export const projectTemplateParams = t.Object({ teamId: t.Numeric(), templateId: t.Numeric() });

export const saveProjectTemplateBody = t.Object({
  projectId: t.Integer({ description: 'The project of the team to save as a template.' }),
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String({ maxLength: PROJECT_DESCRIPTION_LIMIT })),
  include: copyInclude,
});

export const ProjectTemplateResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.String(),
  createdAt: t.String(),
});

export const ProjectTemplateListResponse = t.Array(ProjectTemplateResponse);

export const ProjectTemplateDetailResponse = t.Composite([
  ProjectTemplateResponse,
  t.Object({
    columns: t.Array(ColumnResponse),
    issueTypes: t.Array(IssueTypeResponse),
    labels: t.Array(LabelResponse),
    labelGroups: t.Array(LabelGroupResponse),
    customFields: t.Array(CustomFieldResponse),
    issueTemplates: IssueTemplateListResponse,
    views: t.Array(ViewResponse),
    dashboards: DashboardListResponse,
    actions: ActionListResponse,
    features: FeaturesResponse,
    estimates: EstimatesResponse,
    sections: t.Array(
      t.Object(
        { key: t.String(), items: t.Array(t.String()) },
        { description: 'What a section an extension of the api added holds, by name.' },
      ),
    ),
  }),
]);
