import { t } from 'elysia';

export const importJobParams = t.Object({ id: t.Numeric() });

const stateCategory = t.UnionEnum(['backlog', 'unstarted', 'started', 'completed', 'canceled']);

const importJobChoices = {
  unmatchedUserPolicy: t.Optional(
    t.UnionEnum(['unassigned', 'skip'], {
      description:
        'How to handle an assignee or comment author with no matching project member by email. ' +
        "'unassigned' (default) leaves the field empty; 'skip' drops the assignment or comment.",
    }),
  ),
  stateOverrides: t.Optional(
    t.Record(t.String(), stateCategory, {
      description: 'Source state id -> itsaplan state category, overriding the automatic mapping.',
    }),
  ),
};

// The fields Plane needs to reach the source project, plus the mapping choices made
// at creation time. A body without `source` is a Plane job.
const planeImportJobBody = t.Object({
  source: t.Optional(t.Literal('plane')),
  baseUrl: t.String({ minLength: 1, description: 'Origin of the source Plane instance.' }),
  workspaceSlug: t.String({ minLength: 1 }),
  apiToken: t.String({ minLength: 1, description: 'Plane workspace or personal API key.' }),
  planeProjectId: t.String({ minLength: 1, description: 'The Plane project id to import from.' }),
  planeProjectKey: t.String({
    minLength: 1,
    description:
      'The Plane project\'s own short identifier (e.g. "ROOMS"), used to recognize and ' +
      'rewrite cross-references like "ROOMS-524" in imported text.',
  }),
  ...importJobChoices,
});

// One Linear team, and one of its projects or its issues with no project.
const linearImportJobBody = t.Object({
  source: t.Literal('linear'),
  apiToken: t.String({
    minLength: 1,
    description: 'Linear personal API key; read-only is enough.',
  }),
  teamId: t.String({ minLength: 1, description: 'The Linear team id to import from.' }),
  teamKey: t.String({
    minLength: 1,
    description:
      'The team\'s issue-key prefix (e.g. "ATO"), used to recognize and rewrite ' +
      'cross-references like "ATO-505" in imported text.',
  }),
  projectFilter: t.UnionEnum(['project', 'none'], {
    description:
      "'project' imports one project of the team; 'none' imports the team's issues that " +
      'belong to no project.',
  }),
  projectId: t.Optional(
    t.String({
      minLength: 1,
      description: "The Linear project id, when projectFilter is 'project'.",
    }),
  ),
  ...importJobChoices,
});

// One Trello board, with the choices only Trello needs.
const trelloImportJobBody = t.Object({
  source: t.Literal('trello'),
  apiKey: t.String({ minLength: 1, description: 'Trello API key.' }),
  apiToken: t.String({
    minLength: 1,
    description: 'A Trello token made for that key; read access is enough.',
  }),
  boardId: t.String({ minLength: 1, description: 'The Trello board id to import from.' }),
  archivedCards: t.UnionEnum(['archive', 'skip'], {
    description:
      "'archive' imports archived cards, and the cards of archived lists, as archived " +
      "issues; 'skip' leaves them out.",
  }),
  memberMap: t.Optional(
    t.Record(t.String(), t.String(), {
      description:
        'Trello member id -> the user id of a project member. The first matched member of ' +
        'a card is its assignee, the others watch it. A member left out is not matched.',
    }),
  ),
  ...importJobChoices,
});

export const createImportJobBody = t.Union([
  planeImportJobBody,
  linearImportJobBody,
  trelloImportJobBody,
]);

export const testConnectionBody = t.Object({
  baseUrl: t.String({ minLength: 1 }),
  workspaceSlug: t.String({ minLength: 1 }),
  apiToken: t.String({ minLength: 1 }),
});

export const TestConnectionResponse = t.Object({
  projects: t.Array(t.Object({ id: t.String(), name: t.String(), identifier: t.String() })),
});

export const planePreviewBody = t.Object({
  baseUrl: t.String({ minLength: 1 }),
  workspaceSlug: t.String({ minLength: 1 }),
  apiToken: t.String({ minLength: 1 }),
  planeProjectId: t.String({ minLength: 1 }),
});

export const PlanePreviewResponse = t.Object({
  states: t.Array(t.Object({ id: t.String(), name: t.String(), category: stateCategory })),
});

export const linearConnectionBody = t.Object({
  apiToken: t.String({ minLength: 1, description: 'Linear personal API key.' }),
});

export const LinearTestConnectionResponse = t.Object({
  teams: t.Array(
    t.Object({
      id: t.String(),
      key: t.String(),
      name: t.String(),
      projects: t.Array(t.Object({ id: t.String(), name: t.String() })),
    }),
  ),
});

export const linearPreviewBody = t.Object({
  apiToken: t.String({ minLength: 1 }),
  teamId: t.String({ minLength: 1 }),
});

export const LinearPreviewResponse = PlanePreviewResponse;

export const trelloConnectionBody = t.Object({
  apiKey: t.String({ minLength: 1, description: 'Trello API key.' }),
  apiToken: t.String({ minLength: 1, description: 'A Trello token made for that key.' }),
});

export const TrelloTestConnectionResponse = t.Object({
  boards: t.Array(t.Object({ id: t.String(), name: t.String(), closed: t.Boolean() })),
});

export const trelloPreviewBody = t.Object({
  apiKey: t.String({ minLength: 1 }),
  apiToken: t.String({ minLength: 1 }),
  boardId: t.String({ minLength: 1 }),
});

export const TrelloPreviewResponse = t.Object({
  states: PlanePreviewResponse.properties.states,
  members: t.Array(t.Object({ id: t.String(), fullName: t.String(), username: t.String() })),
});

// Mirrors import_record_source_entity_type_check in packages/db/src/schema/app.ts.
const entityCount = t.Object({ discovered: t.Number(), created: t.Number() });
const CountsResponse = t.Object({
  issue: entityCount,
  comment: entityCount,
  label: entityCount,
  state: entityCount,
  cycle: entityCount,
  attachment: entityCount,
  checklist: entityCount,
  custom_field: entityCount,
});

const ExportedComment = t.Object({
  authorName: t.Nullable(t.String()),
  authorEmail: t.Nullable(t.String()),
  body: t.String(),
  createdAt: t.String(),
  replyToIndex: t.Nullable(t.Number()),
});

const ExportedRelation = t.Object({ kind: t.String(), targetIdentifier: t.String() });

const ExportedIssue = t.Object({
  identifier: t.String(),
  title: t.String(),
  description: t.String(),
  state: t.String(),
  labels: t.Array(t.String()),
  cycle: t.Nullable(t.String()),
  priority: t.Nullable(t.String()),
  startDate: t.Nullable(t.String()),
  dueDate: t.Nullable(t.String()),
  parentIdentifier: t.Nullable(t.String()),
  assigneeEmail: t.Nullable(t.String()),
  comments: t.Array(ExportedComment),
  relations: t.Array(ExportedRelation),
});

export const ProjectExportResponse = t.Object({
  exportedAt: t.String(),
  project: t.Object({ key: t.String(), name: t.String(), description: t.String() }),
  states: t.Array(t.Object({ name: t.String(), category: t.String() })),
  labels: t.Array(t.Object({ name: t.String(), color: t.String() })),
  cycles: t.Array(
    t.Object({ name: t.String(), startDate: t.String(), endDate: t.String(), goal: t.String() }),
  ),
  issues: t.Array(ExportedIssue),
});

export const ImportJobResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  source: t.String(),
  phase: t.UnionEnum(['discover', 'create', 'link', 'rewrite', 'attachments', 'done']),
  status: t.UnionEnum(['pending', 'running', 'paused', 'completed', 'failed']),
  counts: CountsResponse,
  lastError: t.Nullable(t.String()),
  nextAttemptAt: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});
