import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { isMcpRequest } from '#shared/mcp-request';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getMemberContext, listAssigneeCandidates } from '#modules/members/service';
import { listColumns } from '#modules/columns/service';
import { listIssueTypes } from '#modules/issue-types/service';
import { listLabels, listLabelGroups } from '#modules/labels/service';
import { listCustomFields } from '#modules/custom-fields/service';
import { listIssueTemplates } from '#modules/issue-templates/service';
import {
  AutoArchiveResponse,
  EstimatesResponse,
  PROJECT_DESCRIPTION_LIMIT,
  ProjectBoardResponse,
  ProjectListResponse,
  ProjectResponse,
  ProjectSettingsResponse,
  SubtaskAutomationResponse,
  copyProjectBody,
  createProjectBody,
  listProjectsQuery,
  updateAutoArchiveBody,
  updateEstimatesBody,
  updateProjectBody,
  updateProjectSettingsBody,
  updateSubtaskAutomationBody,
} from './model';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  setProjectMcpEnabled,
  projectFeatures,
  setProjectFeatures,
  getAutoArchiveSettings,
  setAutoArchiveSettings,
  getSubtaskAutomationSettings,
  setSubtaskAutomationSettings,
  setEstimateSettings,
} from './service';
import { copyProject } from './copy';

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
      query: listProjectsQuery,
      response: { 200: ProjectListResponse, ...errors(401) },
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
      response: { 201: ProjectResponse, ...errors(400, 401) },
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
      response: { 201: ProjectResponse, ...commonErrors },
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
  //
  // Open to any project member: the payload is the project's own naming (columns,
  // types, labels, fields) plus the caller's own access, not the work items
  // themselves. A role without work item access still needs it to open any page.
  .get(
    '/projects/:projectKey',
    async ({ project, user }) => {
      const [
        columns,
        issueTypes,
        labels,
        labelGroups,
        assignees,
        customFields,
        issueTemplates,
        viewer,
      ] = await Promise.all([
        listColumns(project.id),
        listIssueTypes(project.id),
        listLabels(project.id),
        listLabelGroups(project.id),
        listAssigneeCandidates(project.id),
        listCustomFields(project.id, { allTypes: true }),
        listIssueTemplates(project.id),
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
        issueTemplates,
        viewer: { role: viewer.role },
        permissions: viewer.permissions,
      };
    },
    {
      projectMember: true,
      response: { 200: ProjectBoardResponse, ...accessErrors },
      detail: {
        summary: 'Get a project',
        description:
          'Get a project setup by key: columns, issue types, labels, custom fields, issue ' +
          'templates, and assignable users and agents. Resolves the ids create_issue and update_issue ' +
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
      body: updateProjectBody,
      projectOwner: true,
      response: { 200: ProjectResponse, ...commonErrors },
      detail: {
        summary: 'Update a project',
        description:
          "Update a project's name and/or description. The description is given to the " +
          `agents of the project in their system prompt; up to ${PROJECT_DESCRIPTION_LIMIT} ` +
          'characters. The key is immutable.',
        ...mcpTool('update_project'),
      },
    },
  )

  // Reads the project's settings: whether it is reachable over MCP and which
  // optional sections are enabled. Any member may read.
  .get(
    '/projects/:projectKey/settings',
    ({ project }) => ({
      mcpEnabled: project.mcpEnabled,
      features: projectFeatures(project),
    }),
    {
      projectMember: true,
      response: { 200: ProjectSettingsResponse, ...accessErrors },
      detail: { summary: "Get a project's settings" },
    },
  )

  // Updates the project's settings. Each field is optional; only the supplied ones
  // change. mcpEnabled toggles MCP access to the project. features turns the
  // optional sections on or off. Owner-only. Not an MCP tool: it governs MCP
  // access, so an agent must not change it.
  .patch(
    '/projects/:projectKey/settings',
    async ({ project, body }) => {
      let current = project;
      if (body.mcpEnabled !== undefined) {
        const updated = await setProjectMcpEnabled(project.id, body.mcpEnabled);
        if (!updated) throw new HttpError(404, 'Project not found');
        current = updated;
      }
      if (body.features !== undefined) {
        const updated = await setProjectFeatures(project.id, body.features);
        if (!updated) throw new HttpError(404, 'Project not found');
        current = updated;
      }
      return { mcpEnabled: current.mcpEnabled, features: projectFeatures(current) };
    },
    {
      body: updateProjectSettingsBody,
      projectOwner: true,
      response: { 200: ProjectSettingsResponse, ...commonErrors },
      detail: { summary: "Update a project's settings" },
    },
  )

  // The workflow configuration — the auto-archive thresholds and the subtask
  // automations — is its own permission resource rather than part of the settings
  // payload above: a granted role reads or changes it without being an owner.
  .get(
    '/projects/:projectKey/settings/auto-archive',
    ({ project }) => getAutoArchiveSettings(project.id),
    {
      permission: ['workflow_config', 'read'],
      response: { 200: AutoArchiveResponse, ...accessErrors },
      detail: { summary: "Get a project's auto-archive thresholds" },
    },
  )

  // Sets both thresholds at once: a partial body would read as "leave the other
  // group as it is", which this endpoint does not do.
  .patch(
    '/projects/:projectKey/settings/auto-archive',
    ({ project, body }) => setAutoArchiveSettings(project.id, body),
    {
      body: updateAutoArchiveBody,
      permission: ['workflow_config', 'edit'],
      response: { 200: AutoArchiveResponse, ...commonErrors },
      detail: { summary: "Update a project's auto-archive thresholds" },
    },
  )

  .get(
    '/projects/:projectKey/settings/subtasks',
    ({ project }) => getSubtaskAutomationSettings(project.id),
    {
      permission: ['workflow_config', 'read'],
      response: { 200: SubtaskAutomationResponse, ...accessErrors },
      detail: { summary: "Get a project's subtask automations" },
    },
  )

  // Both automations are sent together, the same as the thresholds above.
  .patch(
    '/projects/:projectKey/settings/subtasks',
    ({ project, body }) => setSubtaskAutomationSettings(project.id, body),
    {
      body: updateSubtaskAutomationBody,
      permission: ['workflow_config', 'edit'],
      response: { 200: SubtaskAutomationResponse, ...commonErrors },
      detail: { summary: "Update a project's subtask automations" },
    },
  )

  // The estimate kinds the issues carry and whether members log the time they
  // spend. The current state comes with the project payload every member already
  // gets, so only the write lives here.
  .patch(
    '/projects/:projectKey/settings/estimates',
    async ({ project, body }) => {
      const updated = await setEstimateSettings(project.id, body);
      if (!updated) throw new HttpError(404, 'Project not found');
      return updated;
    },
    {
      body: updateEstimatesBody,
      permission: ['workflow_config', 'edit'],
      response: { 200: EstimatesResponse, ...commonErrors },
      detail: { summary: "Update a project's estimate kinds and time logging" },
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
      response: { 204: t.Void(), ...accessErrors },
      detail: {
        summary: 'Delete a project',
        description: 'Permanently delete a project and everything in it. Irreversible.',
        ...mcpTool('delete_project'),
      },
    },
  );
