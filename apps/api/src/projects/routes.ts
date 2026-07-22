import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { requireUser } from '../shared/access';
import { isMcpRequest } from '../shared/mcp-request';
import { ErrorResponse } from '../shared/responses';
import { getMemberContext, listAssigneeCandidates } from '../members/store';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  setProjectMcpEnabled,
  getAutoArchiveSettings,
  setAutoArchiveSettings,
  ISSUE_TYPE_PRESET_KEYS,
} from './store';
import { copyProject, COPY_INCLUDE_KEYS } from './copy';
import { listColumns } from '../columns/store';
import { listIssueTypes } from '../issue-types/store';
import { listLabels, listLabelGroups } from '../labels/store';
import { listCustomFields } from '../custom-fields/store';

const projectBody = t.Object({
  key: t.String({ minLength: 1 }),
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
});

// Create adds the issue-type preset: which set of types the new project starts with.
// Omitted → "general" (a single Task). Copy takes its types from the source project,
// so the preset applies to create only.
const createProjectBody = t.Composite([
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
// views, dashboards, actions), matching the copy's original behavior. Each flag maps
// to a section of the project settings menu; the store force-enables dependencies.
const copyProjectBody = t.Composite([
  projectBody,
  t.Object({
    include: t.Optional(
      t.Object(Object.fromEntries(COPY_INCLUDE_KEYS.map((k) => [k, t.Optional(t.Boolean())]))),
    ),
  }),
]);

// A project DTO (ProjectRow from the store).
const ProjectResponse = t.Object({
  id: t.Number(),
  key: t.String(),
  name: t.String(),
  description: t.String(),
  mcpEnabled: t.Boolean(),
  createdAt: t.String(),
});

// The permission matrix as resolved for a member: for each resource, the
// create/edit/read/delete flags.
const PermissionMatrix = t.Record(t.String(), t.Record(t.String(), t.Boolean()));

// A project in the caller's list (ProjectListItem): ProjectRow plus the caller's
// own role in it, and the caller's permission matrix when requested with
// ?permissions=true.
const ProjectListItemResponse = t.Composite([
  ProjectResponse,
  t.Object({
    role: t.Union([t.Literal('owner'), t.Literal('member')]),
    permissions: t.Optional(PermissionMatrix),
  }),
]);

// A column (ColumnRow from columns/store).
const ColumnResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  stateType: t.String(),
  color: t.String(),
  position: t.Number(),
});

// An issue type (IssueTypeRow from issue-types/store).
const IssueTypeResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.String(),
  color: t.String(),
  isDefault: t.Boolean(),
  position: t.Number(),
});

// A label (LabelRow from labels/store).
const LabelResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  groupId: t.Nullable(t.Number()),
  name: t.String(),
  color: t.String(),
});

// A label group (LabelGroupRow from labels/store).
const LabelGroupResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  color: t.String(),
});

// An assignable candidate (AssigneeCandidate from members/store): a project
// member or an AI agent's bot user.
const AssigneeCandidateResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  image: t.Nullable(t.String()),
  kind: t.Union([t.Literal('member'), t.Literal('agent')]),
  agentKind: t.Nullable(t.Union([t.Literal('external'), t.Literal('internal')])),
});

// A custom field option (CustomFieldOptionRow from custom-fields/store).
const CustomFieldOptionResponse = t.Object({
  id: t.Number(),
  value: t.String(),
  color: t.String(),
  position: t.Number(),
});

// A custom field (CustomFieldRow from custom-fields/store). The board carries every
// field of the project; the client filters by issueTypeId.
const CustomFieldResponse = t.Object({
  id: t.Number(),
  issueTypeId: t.Nullable(t.Number()),
  name: t.String(),
  fieldType: t.String(),
  showInBody: t.Boolean(),
  position: t.Number(),
  options: t.Array(CustomFieldOptionResponse),
});

// Auto-archive thresholds (AutoArchiveSettings from the store): days of inactivity
// in a completed/canceled column before the worker archives an issue; null = off.
const AutoArchiveResponse = t.Object({
  completedDays: t.Nullable(t.Number()),
  canceledDays: t.Nullable(t.Number()),
});

// The project's settings: MCP reachability and the auto-archive thresholds.
const ProjectSettingsResponse = t.Object({
  mcpEnabled: t.Boolean(),
  autoArchive: AutoArchiveResponse,
});

// The caller's own role in a project (from MemberContext in members/store). The
// resolved permission matrix is a sibling `permissions` key on the board payload.
const ViewerResponse = t.Object({
  role: t.Union([t.Literal('owner'), t.Literal('member')]),
});

// The project board scaffold (GET /projects/:projectKey): the project plus its
// columns, issue types, labels, label groups, assignable users, custom fields, and
// the caller's own effective access. The issues themselves come from
// GET /projects/:projectKey/issues/board.
const ProjectBoardResponse = t.Object({
  project: ProjectResponse,
  columns: t.Array(ColumnResponse),
  issueTypes: t.Array(IssueTypeResponse),
  labels: t.Array(LabelResponse),
  labelGroups: t.Array(LabelGroupResponse),
  assignees: t.Array(AssigneeCandidateResponse),
  customFields: t.Array(CustomFieldResponse),
  viewer: ViewerResponse,
  // The caller's resolved permission matrix (owners get every flag).
  permissions: PermissionMatrix,
});

export const projectRoutes = new Elysia({ name: 'projects', detail: { tags: ['Projects'] } })
  .use(authContext)
  .use(guards)
  .get(
    '/projects',
    ({ user, request, query }) =>
      listProjects(requireUser(user).id, {
        mcpOnly: isMcpRequest(request.headers),
        withPermissions: query.permissions === 'true',
      }),
    {
      query: t.Object({
        permissions: t.Optional(
          t.String({
            description: "'true' to include the caller's permission matrix per project.",
          }),
        ),
      }),
      response: {
        200: t.Array(ProjectListItemResponse),
        401: ErrorResponse,
      },
      detail: {
        summary: 'List projects',
        description:
          'List the projects you are a member of. Pass permissions=true to include your ' +
          'permission matrix on each.',
        ...mcpTool('list_projects'),
      },
    },
  )

  .post(
    '/projects',
    async ({ body, user, set }) => {
      set.status = 201;
      return createProject(body, requireUser(user).id);
    },
    {
      body: createProjectBody,
      response: {
        201: ProjectResponse,
        400: ErrorResponse,
        401: ErrorResponse,
      },
      detail: {
        summary: 'Create a project',
        description:
          'Create a project you own. `key` is the unique, immutable prefix for issue ids ' +
          "(e.g. 'MKT' -> 'MKT-1'). Seeds the default columns and the issue types of the " +
          'chosen `preset`.',
        ...mcpTool('create_project'),
      },
    },
  )

  // Creates a new project copying the selected parts of the source project's
  // configuration (states, issue types, labels, custom fields, views, dashboards,
  // actions, roles, settings, notification providers, webhooks, integrations, tools,
  // skills, agents, schedules) but none of its issues. `include` picks the sections;
  // omitted, the project structure is copied as before.
  .post(
    '/projects/:projectKey/copy',
    async ({ project, body, user, set }) => {
      const { include, ...meta } = body;
      try {
        set.status = 201;
        return await copyProject(project.id, meta, requireUser(user).id, include);
      } catch (err) {
        // Return the real cause in the body so the UI shows the actual error.
        console.error('copyProject failed:', err);
        set.status = 400;
        return { error: err instanceof Error ? err.message : 'Failed to copy project' };
      }
    },
    {
      body: copyProjectBody,
      permission: ['work_items', 'read'],
      response: {
        201: ProjectResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Copy a project',
        description:
          "Copy a project's configuration into a new project you own, without its issues. " +
          'By default the structure (states, issue types, labels, custom fields, views, ' +
          'dashboards, actions) is copied. Pass `include` to choose sections; the API ' +
          'force-enables dependencies (e.g. a view pulls in the states it references).',
        ...mcpTool('copy_project'),
      },
    },
  )

  // Full project view: columns, issue types, labels, issues, and the caller's own
  // effective access (role + resolved permission matrix) — everything the work
  // items UI needs in one call. Assignee options come from the project's members
  // and AI agents, fetched separately. The web app gates its UI off `viewer`; the
  // API still enforces the same matrix on every request.
  .get(
    '/projects/:projectKey',
    async ({ project, user }) => {
      const [columns, issueTypes, labels, labelGroups, assignees, customFields, viewer] =
        await Promise.all([
          listColumns(project.id),
          listIssueTypes(project.id),
          listLabels(project.id),
          listLabelGroups(project.id),
          listAssigneeCandidates(project.id),
          listCustomFields(project.id, { allTypes: true }),
          getMemberContext(project.id, requireUser(user).id),
        ]);
      // The permission guard already asserted membership, so a context always
      // exists here; guard against a race (membership revoked mid-request).
      if (!viewer) throw new HttpError(403, 'You do not have access to this project');
      return {
        project,
        columns,
        issueTypes,
        labels,
        labelGroups,
        assignees,
        customFields,
        viewer: { role: viewer.role },
        permissions: viewer.permissions,
      };
    },
    {
      permission: ['work_items', 'read'],
      response: {
        200: ProjectBoardResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get a project',
        description:
          'Get a project setup by key: columns, issue types, labels, custom fields, and ' +
          'assignable users and agents. Resolves the ids create_issue and update_issue ' +
          'take. For issues use list_issues or search_issues.',
        ...mcpTool('get_project'),
      },
    },
  )

  // Updates a project's editable metadata (name, description). The key is the
  // immutable issue-identifier prefix and cannot change. Owner-only.
  .patch(
    '/projects/:projectKey',
    async ({ project, body }) => {
      const updated = await updateProject(project.id, body);
      if (!updated) throw new HttpError(404, 'Project not found');
      return updated;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.String()),
      }),
      projectOwner: true,
      response: {
        200: ProjectResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Update a project',
        description: "Update a project's name and/or description. The key is immutable.",
        ...mcpTool('update_project'),
      },
    },
  )

  // Reads the project's settings: whether it is reachable over MCP, and the
  // auto-archive thresholds (days of inactivity in a completed/canceled column
  // before the worker archives an issue; null = off). Any member may read.
  .get(
    '/projects/:projectKey/settings',
    async ({ project }) => ({
      mcpEnabled: project.mcpEnabled,
      autoArchive: await getAutoArchiveSettings(project.id),
    }),
    {
      projectMember: true,
      response: {
        200: ProjectSettingsResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "Get a project's settings" },
    },
  )

  // Updates the project's settings. Each field is optional; only the supplied ones
  // change. mcpEnabled toggles MCP access to the project. autoArchive sets the day
  // count per state group (positive integer) or disables it (null). Owner-only.
  // Not an MCP tool: it governs MCP access, so an agent must not change it.
  .patch(
    '/projects/:projectKey/settings',
    async ({ project, body }) => {
      let mcpEnabled = project.mcpEnabled;
      if (body.mcpEnabled !== undefined) {
        const updated = await setProjectMcpEnabled(project.id, body.mcpEnabled);
        if (!updated) throw new HttpError(404, 'Project not found');
        mcpEnabled = updated.mcpEnabled;
      }
      const autoArchive =
        body.autoArchive !== undefined
          ? await setAutoArchiveSettings(project.id, body.autoArchive)
          : await getAutoArchiveSettings(project.id);
      return { mcpEnabled, autoArchive };
    },
    {
      body: t.Object({
        mcpEnabled: t.Optional(t.Boolean()),
        autoArchive: t.Optional(
          t.Object({
            completedDays: t.Nullable(t.Integer({ minimum: 1 })),
            canceledDays: t.Nullable(t.Integer({ minimum: 1 })),
          }),
        ),
      }),
      projectOwner: true,
      response: {
        200: ProjectSettingsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "Update a project's settings" },
    },
  )

  // Permanently removes the project and everything scoped to it. Irreversible.
  // Owner-only.
  .delete(
    '/projects/:projectKey',
    async ({ project }) => {
      await deleteProject(project.id);
      return noContent();
    },
    {
      permission: ['danger_zone', 'delete'],
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a project',
        description: 'Permanently delete a project and everything in it. Irreversible.',
        ...mcpTool('delete_project'),
      },
    },
  );
