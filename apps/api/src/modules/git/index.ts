import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { noContent } from '#shared/http';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import {
  AvailableGitRepositoryPageResponse,
  DevelopmentRepositoryResponse,
  GitProviderConnectionListResponse,
  GitManagedRepositoryResponse,
  GitProviderConnectionResponse,
  GitSettingsResponse,
  ImportRepositoryIssuesResponse,
  RepositoryMappingResponse,
  availableRepositoriesQuery,
  connectRepositoriesBody,
  createGitProviderConnectionBody,
  gitManagedRepositoryParams,
  gitProviderConnectionParams,
  importRepositoryIssuesBody,
  managedRepositoryParams,
  teamGitProviderConnectionParams,
  updateGitSettingsBody,
  updateManagedRepositoryBody,
} from './model';
import { getOrCreateGitSettings, regenerateGitSecret, updateGitSettings } from './service';
import {
  connectGitProvider,
  connectRepositories,
  disconnectGitProvider,
  disconnectRepository,
  getRepositoryMapping,
  listAvailableRepositories,
  listDevelopmentRepositories,
  listGitProviderConnections,
  listTeamGitProviderConnections,
  reconcileManagedWebhooks,
  updateManagedRepository,
} from './connections-service';
import { importRepositoryIssues } from './issue-sync';

export const gitSettingsRoutes = new Elysia({
  name: 'git-settings',
  detail: { tags: ['Git'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/teams/:teamId/settings/git/connections',
    ({ membership }) => listTeamGitProviderConnections(membership.teamId),
    {
      teamManager: true,
      response: { 200: GitProviderConnectionListResponse, ...accessErrors },
      detail: { summary: 'List team Git provider accounts' },
    },
  )
  .post(
    '/teams/:teamId/settings/git/connections',
    async ({ membership, body, set }) => {
      const connection = await connectGitProvider(membership.teamId, body);
      set.status = 201;
      return connection;
    },
    {
      teamManager: true,
      body: createGitProviderConnectionBody,
      response: { 201: GitProviderConnectionResponse, ...commonErrors, ...errors(502) },
      detail: { summary: 'Connect or rotate a team Git provider account' },
    },
  )
  .delete(
    '/teams/:teamId/settings/git/connections/:connectionId',
    async ({ membership, params }) => {
      await disconnectGitProvider(membership.teamId, params.connectionId);
      return noContent();
    },
    {
      teamManager: true,
      params: teamGitProviderConnectionParams,
      response: { 204: t.Void(), ...commonErrors, ...errors(502) },
      detail: { summary: 'Disconnect a team Git provider account and its managed webhooks' },
    },
  )
  // Read on the same right as issues, whose development links already name these
  // repositories, so an agent on the default role can find where its project's code is.
  .get(
    '/projects/:projectKey/repositories',
    ({ project }) => listDevelopmentRepositories(project.id),
    {
      permission: ['work_items', 'read'],
      response: { 200: t.Array(DevelopmentRepositoryResponse), ...accessErrors },
      detail: {
        summary: 'List repositories connected to a project',
        description:
          'List the repositories connected to the project in its settings, with the provider ' +
          'and the address of the instance each one is on.',
        ...mcpTool('list_project_repositories'),
      },
    },
  )
  .get('/projects/:projectKey/settings/git', ({ project }) => getOrCreateGitSettings(project.id), {
    permission: ['repositories', 'edit'],
    response: { 200: GitSettingsResponse, ...accessErrors },
    detail: {
      summary: "Get a project's repository integration settings",
      description:
        'Return whether the integration is on, the webhook endpoint and its secret, the pull request automations, and the repositories that delivered events.',
    },
  })
  .patch(
    '/projects/:projectKey/settings/git',
    ({ project, body }) => updateGitSettings(project.id, body),
    {
      permission: ['repositories', 'edit'],
      body: updateGitSettingsBody,
      response: { 200: GitSettingsResponse, ...commonErrors },
      detail: {
        summary: "Update a project's repository integration settings",
        description:
          'Turn the integration on or off, and configure the issue state changes linked pull requests apply.',
      },
    },
  )
  .post(
    '/projects/:projectKey/settings/git/secret',
    async ({ project }) => {
      const settings = await regenerateGitSecret(project.id);
      await reconcileManagedWebhooks(project.id, settings);
      return settings;
    },
    {
      permission: ['repositories', 'edit'],
      response: { 200: GitSettingsResponse, ...accessErrors },
      detail: {
        summary: "Regenerate a project's repository webhook secret",
        description:
          'Replace the shared webhook secret and update every webhook managed through a provider connection.',
      },
    },
  )
  .get(
    '/projects/:projectKey/settings/git/connections',
    ({ project }) => listGitProviderConnections(project.id),
    {
      permission: ['repositories', 'edit'],
      response: { 200: GitProviderConnectionListResponse, ...accessErrors },
      detail: {
        summary: 'List team Git provider accounts available to a project',
        description:
          'List accounts shared by this project’s team and repositories assigned to this project.',
      },
    },
  )
  .get(
    '/projects/:projectKey/settings/git/connections/:connectionId/repositories',
    ({ project, params, query }) =>
      listAvailableRepositories(
        project.id,
        params.connectionId,
        query.page ?? 1,
        query.search ?? '',
      ),
    {
      permission: ['repositories', 'edit'],
      params: gitProviderConnectionParams,
      query: availableRepositoriesQuery,
      response: { 200: AvailableGitRepositoryPageResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'List repositories available through a Git provider connection',
        description:
          'Search repositories visible to the connected provider account and report which ones are already connected.',
      },
    },
  )
  .post(
    '/projects/:projectKey/settings/git/connections/:connectionId/repositories',
    ({ project, params, body }) =>
      connectRepositories(project.id, params.connectionId, body.externalIds),
    {
      permission: ['repositories', 'edit'],
      params: gitProviderConnectionParams,
      body: connectRepositoriesBody,
      response: { 200: GitProviderConnectionResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Connect repositories and install their webhooks',
        description:
          'Add the selected repositories to the project and create or reconcile provider webhooks for pull request and CI events.',
      },
    },
  )
  .delete(
    '/projects/:projectKey/settings/git/connections/:connectionId/repositories/:repositoryId',
    async ({ project, params }) => {
      await disconnectRepository(project.id, params.connectionId, params.repositoryId);
      return noContent();
    },
    {
      permission: ['repositories', 'edit'],
      params: gitManagedRepositoryParams,
      response: { 204: t.Void(), ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Disconnect a repository and remove its managed webhook',
        description:
          'Delete the repository connection and remove the webhook that Plan installed at the provider.',
      },
    },
  )
  .patch(
    '/projects/:projectKey/settings/git/repositories/:repositoryId',
    ({ project, params, body }) => updateManagedRepository(project.id, params.repositoryId, body),
    {
      permission: ['repositories', 'edit'],
      params: managedRepositoryParams,
      body: updateManagedRepositoryBody,
      response: { 200: GitManagedRepositoryResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: "Update a connected repository's issue sync",
        description:
          'Set the issue sync mode, the column new issues land in, comment sync, and the ' +
          'project label and issue type each repository label becomes. labelMappings ' +
          'replaces every mapping.',
      },
    },
  )
  .get(
    '/projects/:projectKey/settings/git/repositories/:repositoryId/mapping',
    ({ project, params }) => getRepositoryMapping(project.id, params.repositoryId),
    {
      permission: ['repositories', 'edit'],
      params: managedRepositoryParams,
      response: { 200: RepositoryMappingResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: "List a connected repository's labels and their mappings",
      },
    },
  )
  .post(
    '/projects/:projectKey/settings/git/repositories/:repositoryId/issues/import',
    ({ project, params, body }) =>
      importRepositoryIssues(project.id, params.repositoryId, body.page ?? 1),
    {
      permission: ['repositories', 'edit'],
      params: managedRepositoryParams,
      body: importRepositoryIssuesBody,
      response: { 200: ImportRepositoryIssuesResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: "Import one page of a connected repository's open issues",
        description:
          'Create an issue for each open repository issue on the page that has none yet. ' +
          'Call again with nextPage until it is null.',
      },
    },
  );
