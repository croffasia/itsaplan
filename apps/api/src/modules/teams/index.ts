import { Elysia, t } from 'elysia';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { paginate } from '#shared/pagination';
import { errors } from '#shared/responses';
import { isMcpRequest } from '#shared/mcp-request';
import { mcpTool } from '#mcp/generate';
import {
  ProjectResponse,
  copyProjectBody,
  createProjectBody,
  updateProjectBody,
} from '#modules/projects/model';
import { createProject, deleteProject, updateProject } from '#modules/projects/service';
import { copyProject } from '#modules/projects/copy';
import {
  TeamDetailResponse,
  TeamListResponse,
  TeamMcpResponse,
  TeamMemberPageResponse,
  TeamProjectDetailResponse,
  TeamProjectMemberPageResponse,
  TeamProjectOptionListResponse,
  TeamProjectPageResponse,
  TeamResponse,
  createTeamBody,
  setTeamMemberRoleBody,
  teamMemberParams,
  teamParams,
  teamProjectListQuery,
  teamProjectParams,
  memberListQuery,
  updateTeamBody,
  updateTeamMcpBody,
} from './model';
import {
  createTeam,
  getTeam,
  getTeamProject,
  leaveTeam,
  listTeamMembers,
  listTeamProjectMembers,
  listTeamProjectOptions,
  listTeamProjects,
  listTeams,
  removeTeamMember,
  renameTeam,
  setTeamMcp,
  setTeamMemberRole,
  teamOwnsProject,
} from './service';

// The write routes act on a project the team owns; one of another team answers 404
// rather than being changed through this team.
async function requireTeamProject(teamId: number, projectId: number): Promise<void> {
  if (!(await teamOwnsProject(teamId, projectId))) throw new HttpError(404, 'Project not found');
}

// The teams the session user belongs to. A team owns projects and its own member
// list; every account is given one at registration and may create more, becoming
// their owner.
export const teamRoutes = new Elysia({ name: 'teams', detail: { tags: ['Teams'] } })
  .use(authContext)
  .use(guards)

  .get(
    '/teams',
    ({ user, request }) =>
      listTeams(requireUser(user).id, { mcpOnly: isMcpRequest(request.headers) }),
    {
      response: { 200: TeamListResponse, ...errors(401) },
      detail: {
        summary: 'List teams',
        description:
          'List the teams you are a member of, with your rank in each. Over MCP, the team is ' +
          'taken from your key when you belong to one; call this to pick a team when a tool ' +
          'asks for a teamId. Only teams with MCP switched on are listed there.',
        ...mcpTool('list_teams'),
      },
    },
  )

  .get(
    '/teams/:teamId',
    async ({ membership }) => {
      const team = await getTeam(membership.teamId, membership.userId);
      if (!team) throw new HttpError(404, 'Team not found');
      return team;
    },
    {
      teamMember: true,
      params: teamParams,
      response: { 200: TeamDetailResponse, ...errors(401, 404) },
      detail: {
        summary: 'Get a team',
        description:
          'A team, with how many projects, members, roles and integration credentials it ' +
          'holds, and what you may do with them. Its members and its projects are listed ' +
          'by their own routes.',
      },
    },
  )

  .get(
    '/teams/:teamId/members',
    ({ membership, query }) =>
      paginate(query, (window) =>
        listTeamMembers(membership.teamId, {
          search: query.search,
          kind: query.kind,
          ...window,
        }),
      ),
    {
      teamMember: true,
      params: teamParams,
      query: memberListQuery,
      response: { 200: TeamMemberPageResponse, ...errors(401, 404) },
      detail: {
        summary: 'List team members',
        description:
          'One page of the members of a team you belong to, by name. `search` matches the ' +
          'name, the address or the handle, and `kind` narrows the list to the people or to ' +
          'the AI agents.',
      },
    },
  )

  .get(
    '/teams/:teamId/projects',
    ({ membership, query }) =>
      paginate(query, (window) =>
        listTeamProjects(membership.teamId, membership.userId, membership.role, {
          search: query.search,
          ...window,
        }),
      ),
    {
      teamMember: true,
      params: teamParams,
      query: teamProjectListQuery,
      response: { 200: TeamProjectPageResponse, ...errors(401, 404) },
      detail: {
        summary: 'List team projects',
        description:
          'One page of the projects a team owns, by key. `search` matches the key or the ' +
          'name. An owner or a manager sees them all; anyone else only the ones they belong to.',
      },
    },
  )

  // Fills the project picker on an agent and the MCP switches, which act on every
  // project of the team rather than on a page of them.
  .get(
    '/teams/:teamId/projects/options',
    ({ membership }) =>
      listTeamProjectOptions(membership.teamId, membership.userId, membership.role),
    {
      teamMember: true,
      params: teamParams,
      response: { 200: TeamProjectOptionListResponse, ...errors(401, 404) },
      detail: {
        summary: 'List team project options',
        description: 'Every project the reader has in the team: id, key, name and MCP reach.',
      },
    },
  )

  .get(
    '/teams/:teamId/projects/:projectId',
    async ({ membership, params }) => {
      const detail = await getTeamProject(
        membership.teamId,
        params.projectId,
        membership.userId,
        membership.role,
      );
      if (!detail) throw new HttpError(404, 'Project not found');
      return detail;
    },
    {
      teamMember: true,
      params: teamProjectParams,
      response: { 200: TeamProjectDetailResponse, ...errors(401, 404) },
      detail: {
        summary: 'Get a project the team owns',
        description:
          'How one project of the team is doing and who can reach it, with what each membership resolves to. An owner or a manager may read it for any project of the team; anyone else only for one they belong to.',
      },
    },
  )

  .get(
    '/teams/:teamId/projects/:projectId/members',
    ({ membership, params, query }) =>
      paginate(query, async (window) => {
        const page = await listTeamProjectMembers(
          membership.teamId,
          params.projectId,
          membership.userId,
          membership.role,
          { search: query.search, kind: query.kind, ...window },
        );
        if (!page) throw new HttpError(404, 'Project not found');
        return page;
      }),
    {
      teamMember: true,
      params: teamProjectParams,
      query: memberListQuery,
      response: { 200: TeamProjectMemberPageResponse, ...errors(401, 404) },
      detail: {
        summary: "List a project's members",
        description:
          'One page of the members of one project of the team, owners first. `search` ' +
          'matches the name, the address or the handle, and `kind` narrows the list to the ' +
          'people or to the AI agents. An owner or a manager may read it for any project of ' +
          'the team; anyone else only for one they belong to.',
      },
    },
  )

  // The team's MCP settings: whether it is reachable at all, and which of its projects
  // that reach covers. Written by an owner or a manager, who run the team; the current
  // state is read off the team list and its projects, which both carry it. Not an MCP
  // tool: it governs MCP access, so an agent must not change it.
  .patch('/teams/:teamId/mcp', ({ body, membership }) => setTeamMcp(membership.teamId, body), {
    teamManager: true,
    params: teamParams,
    body: updateTeamMcpBody,
    response: { 200: TeamMcpResponse, ...errors(400, 401, 403, 404) },
    detail: {
      summary: "Update a team's MCP settings",
      description:
        'Switch MCP on or off for the team, and set which of its projects the reach covers. ' +
        'Each field is optional; a project of another team is ignored.',
    },
  })

  .post(
    '/teams',
    async ({ body, user, set }) => {
      const name = body.name.trim();
      if (!name) throw new HttpError(400, 'Team name is required');
      set.status = 201;
      return createTeam(name, requireUser(user).id);
    },
    {
      body: createTeamBody,
      response: { 201: TeamResponse, ...errors(400, 401) },
      detail: {
        summary: 'Create a team',
        description: 'Create a team and become its owner.',
      },
    },
  )

  .patch(
    '/teams/:teamId',
    async ({ body, membership }) => {
      const name = body.name?.trim();
      if (!name) throw new HttpError(400, 'Team name is required');
      return renameTeam(membership.teamId, name, membership.userId);
    },
    {
      teamOwner: true,
      params: teamParams,
      body: updateTeamBody,
      response: { 200: TeamResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: 'Rename a team',
        description: 'Rename a team you own.',
      },
    },
  )

  .post(
    '/teams/:teamId/projects',
    async ({ body, membership, set }) => {
      set.status = 201;
      return createProject(body, membership.userId, membership.teamId);
    },
    {
      teamManager: true,
      params: teamParams,
      body: createProjectBody,
      response: { 201: ProjectResponse, ...errors(400, 401, 403, 404, 409) },
      detail: {
        summary: 'Create a project in a team',
        description:
          'Create a project the team owns and become its owner. Takes the same body as ' +
          'create_project, which creates in the team you own.',
      },
    },
  )

  .post(
    '/teams/:teamId/projects/:projectId/copy',
    async ({ body, membership, params, set }) => {
      await requireTeamProject(membership.teamId, params.projectId);
      const { include, ...meta } = body;
      set.status = 201;
      return copyProject(params.projectId, meta, membership.userId, include, membership.teamId);
    },
    {
      teamManager: true,
      params: teamProjectParams,
      body: copyProjectBody,
      response: { 201: ProjectResponse, ...errors(400, 401, 403, 404, 409) },
      detail: {
        summary: 'Copy a project of the team',
        description:
          "Copy a project's configuration into a new project of the same team, without its " +
          "issues. The caller becomes the copy's owner, and needs no membership in the " +
          'source project.',
      },
    },
  )

  .patch(
    '/teams/:teamId/projects/:projectId',
    async ({ body, membership, params }) => {
      await requireTeamProject(membership.teamId, params.projectId);
      const updated = await updateProject(params.projectId, body);
      if (!updated) throw new HttpError(404, 'Project not found');
      return updated;
    },
    {
      teamManager: true,
      params: teamProjectParams,
      body: updateProjectBody,
      response: { 200: ProjectResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: 'Update a project of the team',
        description:
          'Update the name and/or description of a project the team owns. The key is immutable.',
      },
    },
  )

  .delete(
    '/teams/:teamId/projects/:projectId',
    async ({ membership, params }) => {
      await requireTeamProject(membership.teamId, params.projectId);
      await deleteProject(params.projectId);
      return noContent();
    },
    {
      teamOwner: true,
      params: teamProjectParams,
      response: { 204: t.Void(), ...errors(401, 403, 404) },
      detail: {
        summary: 'Delete a project of the team',
        description:
          'Permanently delete a project the team owns and everything in it. Irreversible.',
      },
    },
  )

  // The rank a member holds in the team. Run by an owner or a manager, who run the
  // team; an agent's rank is set with the agent, not here.
  .patch(
    '/teams/:teamId/members/:userId',
    async ({ body, membership, params }) => {
      await setTeamMemberRole(membership.teamId, membership, params.userId, body.role);
      return noContent();
    },
    {
      teamManager: true,
      params: teamMemberParams,
      body: setTeamMemberRoleBody,
      response: { 204: t.Void(), ...errors(401, 403, 404, 409) },
      detail: {
        summary: "Update a member's rank in the team",
        description:
          'Set what a member ranks as in the team. Only an owner grants the owner rank or ' +
          'changes what another owner holds.',
      },
    },
  )

  // An agent is removed with its agent settings, not here.
  .delete(
    '/teams/:teamId/members/:userId',
    async ({ membership, params }) => {
      await removeTeamMember(membership.teamId, membership.userId, params.userId);
      return noContent();
    },
    {
      teamOwner: true,
      params: teamMemberParams,
      response: { 204: t.Void(), ...errors(401, 403, 404, 409) },
      detail: {
        summary: 'Remove a member from the team',
        description:
          'Remove a member from the team and from every project the team owns. The issues ' +
          'they were assigned to and the work they logged stay as they are. A membership a ' +
          'provisioned group granted is managed by the identity provider.',
      },
    },
  )

  .post(
    '/teams/:teamId/leave',
    async ({ membership }) => {
      await leaveTeam(membership.teamId, membership.userId);
      return noContent();
    },
    {
      teamMember: true,
      params: teamParams,
      response: { 204: t.Void(), ...errors(401, 404, 409) },
      detail: {
        summary: 'Leave a team',
        description:
          'Leave a team you belong to, and every project it owns. The last owner cannot ' +
          'leave, and neither can a member a provisioned group put there; the projects stay ' +
          'with the team.',
      },
    },
  );
