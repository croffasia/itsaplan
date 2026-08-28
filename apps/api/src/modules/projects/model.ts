import { t } from 'elysia';
import { ColumnResponse } from '#modules/columns/model';
import { CustomFieldResponse } from '#modules/custom-fields/model';
import { IssueTypeResponse } from '#modules/issue-types/model';
import { LabelGroupResponse, LabelResponse } from '#modules/labels/model';
import { PermissionMatrixSchema } from '#shared/permissions';
import { ISSUE_TYPE_PRESET_KEYS } from './service';
import { COPY_INCLUDE_KEYS } from './copy';

// The description goes into the system prompt of every agent run, where it costs
// input tokens each time, so it is capped on the way in and cut again in the prompt.
export const PROJECT_DESCRIPTION_LIMIT = 2000;

const projectBody = t.Object({
  key: t.String({ minLength: 1 }),
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String({ maxLength: PROJECT_DESCRIPTION_LIMIT })),
});

// Create adds the issue-type preset: which set of types the new project starts with.
// Omitted → "general" (a single Task). Copy takes its types from the source project,
// so the preset applies to create only.
export const createProjectBody = t.Composite([
  projectBody,
  t.Object({
    preset: t.Optional(
      t.Union(
        ISSUE_TYPE_PRESET_KEYS.map((k) => t.Literal(k)),
        { description: `Issue-type preset: ${ISSUE_TYPE_PRESET_KEYS.join(', ')}.` },
      ),
    ),
  }),
]);

// Copy adds an optional selection of which parts of the source project to carry over.
// Omitted → the source project's structure (states, types, labels, custom fields,
// views, dashboards, actions). Each flag maps to a section of the project settings
// menu; the service force-enables dependencies.
export const copyProjectBody = t.Composite([
  projectBody,
  t.Object({
    include: t.Optional(
      t.Object(Object.fromEntries(COPY_INCLUDE_KEYS.map((k) => [k, t.Optional(t.Boolean())]))),
    ),
  }),
]);

export const updateProjectBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String({ maxLength: PROJECT_DESCRIPTION_LIMIT })),
});

export const listProjectsQuery = t.Object({
  permissions: t.Optional(
    t.String({ description: "'true' to include the caller's permission matrix per project." }),
  ),
});

// A project DTO (ProjectRow from the service).
export const ProjectResponse = t.Object({
  id: t.Number(),
  key: t.String(),
  name: t.String(),
  description: t.String(),
  mcpEnabled: t.Boolean(),
  // The optional sections, toggled in Settings -> General. All on by default; a
  // disabled section is hidden in the web app and its rows are kept.
  initiativesEnabled: t.Boolean(),
  dashboardsEnabled: t.Boolean(),
  notesEnabled: t.Boolean(),
  cyclesEnabled: t.Boolean(),
  subtasksEnabled: t.Boolean(),
  checklistsEnabled: t.Boolean(),
  issueStatsEnabled: t.Boolean(),
  pointsEstimateEnabled: t.Boolean(),
  timeEstimateEnabled: t.Boolean(),
  timeLoggingEnabled: t.Boolean(),
  createdAt: t.String(),
});

// A project in the caller's list (ProjectListItem): ProjectRow plus the caller's
// own role in it, and the caller's permission matrix when requested with
// ?permissions=true.
export const ProjectListResponse = t.Array(
  t.Composite([
    ProjectResponse,
    t.Object({
      role: t.Union([t.Literal('owner'), t.Literal('member')]),
      permissions: t.Optional(PermissionMatrixSchema),
    }),
  ]),
);

// An assignable candidate (AssigneeCandidate from members/service): a project
// member or an AI agent's bot user.
const AssigneeCandidateResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  username: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  kind: t.Union([t.Literal('member'), t.Literal('agent')]),
  agentKind: t.Nullable(t.Union([t.Literal('external'), t.Literal('internal')])),
  restrictedToUserId: t.Nullable(t.String()),
});

// The caller's own role in a project (from MemberContext in members/service). The
// resolved permission matrix is a sibling `permissions` key on the board payload.
const ViewerResponse = t.Object({
  role: t.Union([t.Literal('owner'), t.Literal('member')]),
});

// The project board scaffold (GET /projects/:projectKey): the project plus its
// columns, issue types, labels, label groups, assignable users, custom fields, and
// the caller's own effective access. The issues themselves come from
// GET /projects/:projectKey/issues/board.
export const ProjectBoardResponse = t.Object({
  project: ProjectResponse,
  columns: t.Array(ColumnResponse),
  issueTypes: t.Array(IssueTypeResponse),
  labels: t.Array(LabelResponse),
  labelGroups: t.Array(LabelGroupResponse),
  assignees: t.Array(AssigneeCandidateResponse),
  customFields: t.Array(CustomFieldResponse),
  viewer: ViewerResponse,
  // The caller's resolved permission matrix (owners get every flag).
  permissions: PermissionMatrixSchema,
});

// Which optional sections the project shows (ProjectFeatures from the service).
const FeaturesResponse = t.Object({
  initiatives: t.Boolean(),
  dashboards: t.Boolean(),
  notes: t.Boolean(),
  cycles: t.Boolean(),
  subtasks: t.Boolean(),
  checklists: t.Boolean(),
  issueStats: t.Boolean(),
});

// The project's settings: MCP reachability and the enabled sections.
export const ProjectSettingsResponse = t.Object({
  mcpEnabled: t.Boolean(),
  features: FeaturesResponse,
});

export const updateProjectSettingsBody = t.Object({
  mcpEnabled: t.Optional(t.Boolean()),
  features: t.Optional(t.Partial(FeaturesResponse)),
});

// Auto-archive thresholds (AutoArchiveSettings from the service): days of inactivity
// in a completed/canceled column before the worker archives an issue; null = off.
export const AutoArchiveResponse = t.Object({
  completedDays: t.Nullable(t.Number()),
  canceledDays: t.Nullable(t.Number()),
});

export const updateAutoArchiveBody = t.Object({
  completedDays: t.Nullable(t.Integer({ minimum: 1 })),
  canceledDays: t.Nullable(t.Integer({ minimum: 1 })),
});

// The estimate kinds the project's issues carry and whether its members log time
// (EstimateSettings from the service). Sent together, the same as the automations
// below.
export const EstimatesResponse = t.Object({
  points: t.Boolean(),
  time: t.Boolean(),
  logging: t.Boolean(),
});

export const updateEstimatesBody = EstimatesResponse;

// The subtask automations (SubtaskAutomationSettings from the service).
export const SubtaskAutomationResponse = t.Object({
  completeParent: t.Boolean(),
  closeSubtasks: t.Boolean(),
});

export const updateSubtaskAutomationBody = SubtaskAutomationResponse;
