import { Elysia } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { checkPermission } from '#shared/access';
import { accessErrors, commonErrors } from '#shared/responses';
import { GithubSettingsResponse, updateGithubSettingsBody } from './model';
import { getOrCreateGithubSettings, regenerateGithubSecret, updateGithubSettings } from './service';

export const githubSettingsRoutes = new Elysia({
  name: 'github-settings',
  detail: { tags: ['GitHub'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/settings/github',
    async ({ project, user }) => {
      const settings = await getOrCreateGithubSettings(project.id);
      const canEdit = await checkPermission(project.id, user, 'integrations', 'edit');
      return { ...settings, secret: canEdit ? settings.secret : null };
    },
    {
      permission: ['integrations', 'read'],
      response: { 200: GithubSettingsResponse, ...accessErrors },
      detail: { summary: "Get a project's GitHub integration settings" },
    },
  )
  .patch(
    '/projects/:projectKey/settings/github',
    ({ project, body }) => updateGithubSettings(project.id, body),
    {
      permission: ['integrations', 'edit'],
      body: updateGithubSettingsBody,
      response: { 200: GithubSettingsResponse, ...commonErrors },
      detail: { summary: "Update a project's GitHub integration settings" },
    },
  )
  .post(
    '/projects/:projectKey/settings/github/secret',
    ({ project }) => regenerateGithubSecret(project.id),
    {
      permission: ['integrations', 'edit'],
      response: { 200: GithubSettingsResponse, ...accessErrors },
      detail: { summary: "Regenerate a project's GitHub webhook secret" },
    },
  );
