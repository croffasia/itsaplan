import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { paginate } from '#shared/pagination';
import { HttpError } from '#shared/lib';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { getProjectAccess, getTeamAccess, requireUser } from '#shared/access';
import { isMcpRequest } from '#shared/mcp-request';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { listAssigneeCandidates } from '#modules/members/service';
import { listColumns } from '#modules/columns/service';
import { listIssueTypes } from '#modules/issue-types/service';
import { listLabels, listLabelGroups } from '#modules/labels/service';
import { listCustomFields } from '#modules/custom-fields/service';
import { listIssueTemplates } from '#modules/issue-templates/service';
import { projectSharingEnabled } from '#modules/workspaces/service';
import {
  AutoArchiveResponse,
  EstimatesResponse,
  ProjectBoardResponse,
  ProjectListResponse,
  ProjectResponse,
  ProjectSearchPageResponse,
  ProjectSettingsResponse,
  SubtaskAutomationResponse,
  copyProjectBody,
  listProjectsQuery,
  searchProjectsQuery,
  updateAutoArchiveBody,
  updateEstimatesBody,
  updateProjectBody,
  updateProjectSettingsBody,
  updateSubtaskAutomationBody,
} from './model';
import {
  listProjects,
  searchProjects,
  updateProject,
  deleteProject,
  projectFeatures,
  setProjectFeatures,
  getAutoArchiveSettings,
  setAutoArchiveSettings,
  getSubtaskAutomationSettings,
  setSubtaskAutomationSettings,
  setEstimateSettings,
} from './service';
import { copyProject } from './copy';
import { projectPreferences } from './preferences';

export const projectRoutes = new Elysia({ name: 'projects', detail: { tags: ['Projects'] } })
  .use(authContext)
  .use(guards)
  .use(projectPreferences)
  .get(
    '/projects',
    ({ user, request, query }) =>
      listProjects(requireUser(user).id, {
        mcpOnly: isMcpRequest(request.headers),
        withPermissions: query.permissions === 'true',
        q: query.q,
        sort: query.sort,
        teamId: query.teamId,
      }),
    {
      query: listProjectsQuery,
      response: { 200: ProjectListResponse, ...errors(400, 401) },
      detail: {
        summary: 'List projects',
        description:
          'List the projects you are a member of, with ' +
          'the time of the last issue activity in each.',
        ...mcpTool('list_projects'),
      },
    },
  )

  .get(
    '/projects/search',
    ({ user, query }) =>
      paginate(query, (window) =>
        searchProjects(
          requireUser(user).id,
          {
            q: query.q,
            sort: query.sort,
            teamId: query.teamId,
            workspaceId: query.workspaceId,
            ids: query.ids?.split(',').map(Number),
            favorite: query.favorite === undefined ? undefined : query.favorite === 'true',
            hidden: query.hidden === undefined ? undefined : query.hidden === 'true',
          },
          window,
        ),
      ),
    {
      query: searchProjectsQuery,
      response: { 200: ProjectSearchPageResponse, ...errors(400, 401) },
      detail: {
        summary: 'Search projects',
        description:
          'A page of the projects you can open, filtered like List projects and also by ' +
          'workspace, by id, and by your star and hidden marks. Starred projects come first.',
      },
    },
  )

  .post(
    '/projects/:projectKey/copy',
    async ({ project, body, user, set }) => {
      const { include, ...meta } = body;
      set.status = 201;
      return await copyProject(project.id, meta, requireUser(user).id, project.teamId, include);
    },
    {
      body: copyProjectBody,
      teamRunsProject: true,
      response: { 201: ProjectResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Copy a project',
        description:
          "Copy a project's configuration, without its issues, into a new project in the same " +
          'team. You become its owner. Only a team owner or manager can copy. By default copies ' +
          'states, issue types, labels, custom fields, issue templates, views, dashboards, ' +
          'documents and actions. `include` selects sections. The sections they depend on are ' +
          'always copied, for example the states a view uses.',
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
      const userId = requireUser(user).id;
      const [
        columns,
        issueTypes,
        labels,
        labelGroups,
        assignees,
        customFields,
        issueTemplates,
        viewer,
        teamAccess,
        sharingEnabled,
      ] = await Promise.all([
        listColumns(project.id),
        listIssueTypes(project.id),
        listLabels(project.id),
        listLabelGroups(project.id),
        listAssigneeCandidates(project.id),
        listCustomFields(project.id, { allTypes: true }),
        listIssueTemplates(project.id),
        getProjectAccess(project.id, userId),
        getTeamAccess(project.teamId, userId),
        projectSharingEnabled(project.id),
      ]);
      // The permission guard already asserted access, so it always exists here; guard
      // against a race (access revoked mid-request).
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
        viewer: { role: viewer.role, teamRole: teamAccess?.role ?? null, via: viewer.via },
        permissions: viewer.permissions,
        sharingEnabled,
      };
    },
    {
      projectMember: true,
      response: { 200: ProjectBoardResponse, ...accessErrors },
      detail: {
        summary: 'Get a project',
        description:
          "Get a project's setup by key: columns, issue types, labels, custom fields, issue " +
          'templates, and assignable users and agents. Gives the ids for create_issue and ' +
          'update_issue. To find issues, use list_issues or search_issues.',
        ...mcpTool('get_project'),
      },
    },
  )

  // Updates a project's name, description, and a key that does not match the key
  // pattern (see updateProject). Owner-only.
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
      response: { 200: ProjectResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Update a project',
        description:
          "Update a project's name, description or key. The project's agents get the " +
          'description in their system prompt. Only a key that does not match the key pattern ' +
          'can change, for example one that starts with a digit. A key used by another team ' +
          'project returns 409.',
        ...mcpTool('update_project'),
      },
    },
  )

  // Reads the project's settings: whether it is reachable over MCP and which
  // optional sections are enabled. Any member may read. MCP reachability is reported
  // as the two flags behind it, so the page can say which one closed the project.
  .get(
    '/projects/:projectKey/settings',
    ({ project }) => ({
      mcpEnabled: project.mcpEnabled,
      teamMcpEnabled: project.teamMcpEnabled,
      features: projectFeatures(project),
    }),
    {
      projectMember: true,
      response: { 200: ProjectSettingsResponse, ...accessErrors },
      detail: { summary: "Get a project's settings" },
    },
  )

  // Updates the project's settings: which optional sections are on. Open to the
  // project's owner and to an owner or manager of the team that runs it. MCP
  // reachability is not here — it is the team's, set in its MCP settings.
  .patch(
    '/projects/:projectKey/settings',
    async ({ project, body }) => {
      let current = project;
      if (body.features !== undefined) {
        const updated = await setProjectFeatures(project.id, body.features);
        if (!updated) throw new HttpError(404, 'Project not found');
        current = updated;
      }
      return {
        mcpEnabled: current.mcpEnabled,
        teamMcpEnabled: current.teamMcpEnabled,
        features: projectFeatures(current),
      };
    },
    {
      body: updateProjectSettingsBody,
      projectAdmin: true,
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
        description: 'Permanently delete a project and everything in it.',
        ...mcpTool('delete_project'),
      },
    },
  );
