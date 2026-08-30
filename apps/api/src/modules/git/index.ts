import { Elysia, t } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { checkPermission } from '#shared/access';
import { noContent } from '#shared/http';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import {
  AvailableGitRepositoryPageResponse,
  GitProviderConnectionListResponse,
  GitProviderConnectionResponse,
  GitSettingsResponse,
  availableRepositoriesQuery,
  connectRepositoriesBody,
  createGitProviderConnectionBody,
  gitManagedRepositoryParams,
  gitProviderConnectionParams,
  updateGitSettingsBody,
} from './model';
import { getOrCreateGitSettings, regenerateGitSecret, updateGitSettings } from './service';
import {
  connectGitProvider,
  connectRepositories,
  disconnectGitProvider,
  disconnectRepository,
  listAvailableRepositories,
  listGitProviderConnections,
  reconcileManagedWebhooks,
} from './connections-service';

export const gitSettingsRoutes = new Elysia({
  name: 'git-settings',
  detail: { tags: ['Git'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/settings/git',
    async ({ project, user }) => {
      const settings = await getOrCreateGitSettings(project.id);
      const canEdit = await checkPermission(project.id, user, 'integrations', 'edit');
      return { ...settings, secret: canEdit ? settings.secret : null };
    },
    {
      permission: ['integrations', 'read'],
      response: { 200: GitSettingsResponse, ...accessErrors },
      detail: { summary: "Get a project's repository integration settings" },
    },
  )
  .patch(
    '/projects/:projectKey/settings/git',
    ({ project, body }) => updateGitSettings(project.id, body),
    {
      permission: ['integrations', 'edit'],
      body: updateGitSettingsBody,
      response: { 200: GitSettingsResponse, ...commonErrors },
      detail: { summary: "Update a project's repository integration settings" },
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
      permission: ['integrations', 'edit'],
      response: { 200: GitSettingsResponse, ...accessErrors },
      detail: { summary: "Regenerate a project's repository webhook secret" },
    },
  )
  .get(
    '/projects/:projectKey/settings/git/connections',
    ({ project }) => listGitProviderConnections(project.id),
    {
      permission: ['integrations', 'read'],
      response: { 200: GitProviderConnectionListResponse, ...accessErrors },
      detail: { summary: "List a project's Git provider connections" },
    },
  )
  .post(
    '/projects/:projectKey/settings/git/connections',
    async ({ project, body, set }) => {
      const connection = await connectGitProvider(project.id, body);
      set.status = 201;
      return connection;
    },
    {
      permission: ['integrations', 'edit'],
      body: createGitProviderConnectionBody,
      response: { 201: GitProviderConnectionResponse, ...commonErrors, ...errors(502) },
      detail: { summary: 'Connect a Git provider account' },
    },
  )
  .delete(
    '/projects/:projectKey/settings/git/connections/:connectionId',
    async ({ project, params }) => {
      await disconnectGitProvider(project.id, params.connectionId);
      return noContent();
    },
    {
      permission: ['integrations', 'edit'],
      params: gitProviderConnectionParams,
      response: { 204: t.Void(), ...commonErrors, ...errors(502) },
      detail: { summary: 'Disconnect a Git provider account' },
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
      permission: ['integrations', 'edit'],
      params: gitProviderConnectionParams,
      query: availableRepositoriesQuery,
      response: { 200: AvailableGitRepositoryPageResponse, ...commonErrors, ...errors(502) },
      detail: { summary: 'List repositories available through a Git provider connection' },
    },
  )
  .post(
    '/projects/:projectKey/settings/git/connections/:connectionId/repositories',
    ({ project, params, body }) =>
      connectRepositories(project.id, params.connectionId, body.externalIds),
    {
      permission: ['integrations', 'edit'],
      params: gitProviderConnectionParams,
      body: connectRepositoriesBody,
      response: { 200: GitProviderConnectionResponse, ...commonErrors, ...errors(502) },
      detail: { summary: 'Connect repositories and install their webhooks' },
    },
  )
  .delete(
    '/projects/:projectKey/settings/git/connections/:connectionId/repositories/:repositoryId',
    async ({ project, params }) => {
      await disconnectRepository(project.id, params.connectionId, params.repositoryId);
      return noContent();
    },
    {
      permission: ['integrations', 'edit'],
      params: gitManagedRepositoryParams,
      response: { 204: t.Void(), ...commonErrors, ...errors(502) },
      detail: { summary: 'Disconnect a repository and remove its managed webhook' },
    },
  );
