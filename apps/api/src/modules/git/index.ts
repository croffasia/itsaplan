import { Elysia } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { checkPermission } from '#shared/access';
import { accessErrors, commonErrors } from '#shared/responses';
import { GitSettingsResponse, updateGitSettingsBody } from './model';
import { getOrCreateGitSettings, regenerateGitSecret, updateGitSettings } from './service';

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
    ({ project }) => regenerateGitSecret(project.id),
    {
      permission: ['integrations', 'edit'],
      response: { 200: GitSettingsResponse, ...accessErrors },
      detail: { summary: "Regenerate a project's repository webhook secret" },
    },
  );
