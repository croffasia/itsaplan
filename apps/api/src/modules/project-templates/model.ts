import { t } from 'elysia';
import { stateType } from '#modules/columns/model';
import { fieldType, memberScope } from '#modules/custom-fields/model';
import {
  copyInclude,
  EstimatesResponse,
  FeaturesResponse,
  PROJECT_DESCRIPTION_LIMIT,
  updateAutoArchiveBody,
  updateSubtaskAutomationBody,
} from '#modules/projects/model';

export const workspaceTemplateParams = t.Object({
  workspaceId: t.Numeric(),
  templateId: t.Numeric(),
});

export const teamTemplateParams = t.Object({ teamId: t.Numeric(), templateId: t.Numeric() });

export const saveProjectTemplateBody = t.Object({
  projectId: t.Integer({
    description: 'A project of a team of the workspace to save as a template.',
  }),
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String({ maxLength: PROJECT_DESCRIPTION_LIMIT })),
  include: copyInclude,
  teamIds: t.Optional(
    t.Array(t.Integer(), {
      minItems: 1,
      description:
        'The teams of the workspace the template is limited to. Omitted, every team of the ' +
        'workspace sees it.',
    }),
  ),
});

export const previewProjectTemplateBody = t.Pick(saveProjectTemplateBody, ['projectId', 'include']);

export const updateProjectTemplateBody = t.Partial(
  t.Object({
    name: t.String({ minLength: 1 }),
    description: t.String({ maxLength: PROJECT_DESCRIPTION_LIMIT }),
    teamIds: t.Nullable(
      t.Array(t.Integer(), {
        minItems: 1,
        description:
          'The teams of the workspace the template is limited to, or null to open it to ' +
          'every team of the workspace.',
      }),
    ),
  }),
  { minProperties: 1 },
);

export const ProjectTemplateResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.String(),
  teamIds: t.Nullable(
    t.Array(t.Number(), {
      description:
        'The teams the template is limited to, null when every team of the workspace sees it.',
    }),
  ),
  createdAt: t.String(),
});

export const ProjectTemplateListResponse = t.Array(ProjectTemplateResponse);

export const TemplatePublicationResponse = t.Object({
  url: t.String(),
  publishedAt: t.String({ format: 'date-time' }),
});

export const WorkspaceProjectTemplateListResponse = t.Array(
  t.Composite([
    ProjectTemplateResponse,
    t.Object({
      publication: t.Nullable(TemplatePublicationResponse, {
        description: 'The page of the template in the gallery, null while it is not published.',
      }),
    }),
  ]),
);

// What a template holds. Every entity keeps the id it had in the project the template was
// saved from: the others reference it by that id.
export const ProjectTemplateContentsResponse = t.Object({
  columns: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
      stateType: t.String(),
      color: t.String(),
      position: t.Number(),
      wipLimit: t.Nullable(t.Number()),
      wipMode: t.String(),
    }),
  ),
  issueTypes: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
      icon: t.String(),
      color: t.String(),
      isDefault: t.Boolean(),
      position: t.Number(),
    }),
  ),
  labelGroups: t.Array(t.Object({ id: t.Number(), name: t.String(), color: t.String() })),
  labels: t.Array(
    t.Object({
      id: t.Number(),
      groupId: t.Nullable(t.Number()),
      name: t.String(),
      color: t.String(),
    }),
  ),
  customFields: t.Array(
    t.Object({
      id: t.Number(),
      issueTypeId: t.Nullable(t.Number()),
      name: t.String(),
      fieldType: t.String(),
      memberScope: t.Nullable(t.String()),
      showInBody: t.Boolean(),
      position: t.Number(),
      options: t.Array(
        t.Object({ id: t.Number(), value: t.String(), color: t.String(), position: t.Number() }),
      ),
    }),
  ),
  issueTemplates: t.Array(
    t.Object({
      name: t.String(),
      description: t.String(),
      titleTemplate: t.String(),
      descriptionTemplate: t.String(),
      typeId: t.Nullable(t.Number()),
      columnId: t.Nullable(t.Number()),
      priority: t.Nullable(t.String()),
      labelIds: t.Array(t.Number()),
    }),
  ),
  views: t.Array(
    t.Object({
      name: t.String(),
      icon: t.Nullable(t.String()),
      filters: t.Any(),
      display: t.Any(),
      position: t.Number(),
    }),
  ),
  dashboards: t.Array(
    t.Object({
      name: t.String(),
      icon: t.Nullable(t.String()),
      layout: t.Any(),
      position: t.Number(),
    }),
  ),
  actions: t.Array(
    t.Object({
      name: t.String(),
      icon: t.String(),
      condition: t.Any(),
      effect: t.Any(),
      position: t.Number(),
    }),
  ),
  settings: t.Array(t.Object({ key: t.String(), value: t.Any() })),
  features: FeaturesResponse,
  estimates: EstimatesResponse,
  sections: t.Array(
    t.Object(
      { key: t.String(), items: t.Array(t.String()) },
      { description: 'What a section an extension of the api added holds, by name.' },
    ),
  ),
});

export const ProjectTemplateDetailResponse = t.Composite([
  ProjectTemplateResponse,
  ProjectTemplateContentsResponse,
]);

// A shared template is pasted from outside, so every object is closed: a key it does not
// list is dropped and never reaches the insert of the row it sits in.
const strict = <T extends Parameters<typeof t.Object>[0]>(properties: T) =>
  t.Object(properties, { additionalProperties: false });

const entityId = t.Integer();
const entityName = t.String({ minLength: 1 });

// The settings a shared template carries, each checked as its own route checks it.
const sharedSetting = t.Union([
  strict({ key: t.Literal('auto_archive'), value: strict(updateAutoArchiveBody.properties) }),
  strict({
    key: t.Literal('subtask_automation'),
    value: strict(updateSubtaskAutomationBody.properties),
  }),
]);

const sharedSnapshot = strict({
  flags: strict({
    initiativesEnabled: t.Boolean(),
    dashboardsEnabled: t.Boolean(),
    documentsEnabled: t.Boolean(),
    notesEnabled: t.Boolean(),
    cyclesEnabled: t.Boolean(),
    subtasksEnabled: t.Boolean(),
    checklistsEnabled: t.Boolean(),
    issueStatsEnabled: t.Boolean(),
    pointsEstimateEnabled: t.Boolean(),
    timeEstimateEnabled: t.Boolean(),
    timeLoggingEnabled: t.Boolean(),
  }),
  columns: t.Array(
    strict({
      id: entityId,
      name: entityName,
      stateType,
      color: t.String(),
      position: t.Integer(),
      wipLimit: t.Nullable(t.Integer({ minimum: 1 })),
      wipMode: t.Union([t.Literal('soft'), t.Literal('hard')]),
    }),
  ),
  issueTypes: t.Array(
    strict({
      id: entityId,
      name: entityName,
      icon: t.String(),
      color: t.String(),
      isDefault: t.Boolean(),
      position: t.Integer(),
    }),
  ),
  labelGroups: t.Array(strict({ id: entityId, name: entityName, color: t.String() })),
  labels: t.Array(
    strict({ id: entityId, groupId: t.Nullable(entityId), name: entityName, color: t.String() }),
  ),
  customFields: t.Array(
    strict({
      id: entityId,
      issueTypeId: t.Nullable(entityId),
      name: entityName,
      fieldType,
      memberScope: t.Nullable(memberScope),
      showInBody: t.Boolean(),
      position: t.Integer(),
      options: t.Array(
        strict({ id: entityId, value: entityName, color: t.String(), position: t.Integer() }),
      ),
    }),
  ),
  issueTemplates: t.Array(
    strict({
      name: entityName,
      description: t.String(),
      titleTemplate: t.String(),
      descriptionTemplate: t.String(),
      typeId: t.Nullable(entityId),
      columnId: t.Nullable(entityId),
      priority: t.Nullable(t.String()),
      labelIds: t.Array(entityId),
    }),
  ),
  // The filter, display, layout, condition and effect blobs are the UI's, stored as the
  // view, dashboard and action routes store them.
  views: t.Array(
    strict({
      name: entityName,
      icon: t.Nullable(t.String()),
      filters: t.Any(),
      display: t.Any(),
      position: t.Number(),
    }),
  ),
  dashboards: t.Array(
    strict({
      name: entityName,
      icon: t.Nullable(t.String()),
      layout: t.Array(t.Unknown()),
      position: t.Number(),
    }),
  ),
  actions: t.Array(
    strict({
      name: entityName,
      icon: t.String(),
      condition: t.Any(),
      effect: t.Any(),
      position: t.Number(),
    }),
  ),
  settings: t.Array(sharedSetting),
});

export const SharedProjectTemplate = strict({
  format: t.Literal('itsaplan.project-template'),
  version: t.Literal(1),
  name: t.String(),
  description: t.String(),
  snapshot: sharedSnapshot,
});

export const previewImportedTemplateBody = t.Object({ template: SharedProjectTemplate });

export const importProjectTemplateBody = t.Object({
  template: SharedProjectTemplate,
  name: saveProjectTemplateBody.properties.name,
  description: saveProjectTemplateBody.properties.description,
  teamIds: saveProjectTemplateBody.properties.teamIds,
});

const publisherEmail = t.String({ format: 'email', maxLength: 200 });

export const publisherCodeBody = t.Object({ email: publisherEmail });

export const linkPublisherBody = t.Object({
  email: publisherEmail,
  code: t.String({ pattern: '^[0-9]{6}$', description: 'The code the gallery emailed.' }),
});

export const TemplatePublisherResponse = t.Object({
  email: t.String(),
  authorName: t.String(),
  authorUrl: t.Nullable(t.String()),
});

export const publisherAuthorBody = t.Object({
  authorName: t.String({
    minLength: 1,
    maxLength: 80,
    pattern: '\\S',
    description: 'Shown as the author of every template the address publishes.',
  }),
  authorUrl: t.Optional(
    t.Nullable(
      t.String({
        format: 'uri',
        pattern: '^https://',
        maxLength: 200,
        description: "A link to the author's profile, shown beside the name.",
      }),
    ),
  ),
});
