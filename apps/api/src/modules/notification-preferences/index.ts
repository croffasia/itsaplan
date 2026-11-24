import { Elysia, t } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { noContent } from '#shared/http';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import {
  AccountNotificationPreferencesPatch,
  AccountNotificationPreferencesResponse,
  NotificationPreferences,
  ProjectNotificationPreferenceBody,
} from './model';
import {
  getAccountPreferences,
  getProjectPreferences,
  setProjectPreferences,
  updateAccountPreferences,
} from './service';

// A user's own notification preferences: which issue events they want by email, Telegram,
// Slack and/or Web Push, as defaults for all their projects and per project. Every route
// is self-scoped to the session user, so bare project membership is enough (no admin
// gate). The project's provider credentials are a separate, owner-only concern
// (notification-settings), and where the member is reached comes from their linked
// Telegram account (/telegram/account), their Slack accounts (/slack/accounts) and their
// browsers (/push/subscriptions), not from here.
export const notificationPreferenceRoutes = new Elysia({
  name: 'notification-preferences',
  detail: { tags: ['Settings'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/account/notification-preferences',
    ({ user }) => getAccountPreferences(requireUser(user).id),
    {
      response: { 200: AccountNotificationPreferencesResponse, ...errors(401) },
      detail: {
        summary: 'Get notification preferences of all projects',
        description:
          "The current user's default notification preferences, and those of every project they are a member of.",
      },
    },
  )

  .patch(
    '/account/notification-preferences',
    async ({ user, body }) => {
      await updateAccountPreferences(requireUser(user).id, body);
      return noContent();
    },
    {
      body: AccountNotificationPreferencesPatch,
      response: { 204: t.Void(), ...errors(400, 401, 403) },
      detail: {
        summary: 'Update notification preferences of several projects',
        description:
          "Replaces the current user's default notification preferences and those of the listed projects. What is left out keeps its value.",
      },
    },
  )

  .get(
    '/projects/:projectKey/notification-preferences',
    ({ project, user }) => getProjectPreferences(requireUser(user).id, project.id),
    {
      projectMember: true,
      response: { 200: NotificationPreferences, ...accessErrors },
      detail: {
        summary: 'Get notification preferences',
        description:
          "Get the current user's notification preferences for a project: its own, or the defaults it follows.",
      },
    },
  )

  .put(
    '/projects/:projectKey/notification-preferences',
    ({ project, user, body }) => setProjectPreferences(requireUser(user).id, project.id, body),
    {
      body: ProjectNotificationPreferenceBody,
      projectMember: true,
      response: { 200: NotificationPreferences, ...commonErrors },
      detail: {
        summary: 'Update notification preferences',
        description:
          "Update the current user's notification preferences for a project, which then stops following the defaults.",
      },
    },
  );
