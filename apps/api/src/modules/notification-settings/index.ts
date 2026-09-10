import { Elysia } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { errors } from '#shared/responses';
import { getProjectEmailConfig } from '@repo/db';
import { teamParams } from '#modules/teams/model';
import { NotificationSettingsBody, NotificationSettingsResponse } from './model';
import {
  getNotificationSettings,
  setNotificationSettings,
  type NotificationSettingsDto,
} from './service';

// Adds whether the instance provider is available to teams right now. It is an
// instance setting, so it is reported alongside the team's own settings rather
// than stored with them.
async function withSystemAvailability(settings: NotificationSettingsDto) {
  return { ...settings, systemAvailable: (await getProjectEmailConfig()) !== null };
}

// Notification provider credentials carry secrets (SMTP password, Resend key,
// Telegram bot token), so they are managed only through the session UI and not
// exposed as MCP tools. They belong to the team and serve every project it owns, so
// only its owner reads or changes them. A member's own delivery preferences live in
// notification-preferences.
export const notificationSettingsRoutes = new Elysia({
  name: 'notification-settings',
  detail: { tags: ['Settings'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/teams/:teamId/notification-settings',
    async ({ membership }) =>
      withSystemAvailability(await getNotificationSettings(membership.teamId)),
    {
      teamOwner: true,
      params: teamParams,
      response: { 200: NotificationSettingsResponse, ...errors(401, 403, 404) },
      detail: {
        summary: 'Get notification provider settings',
        description: "Get a team's notification provider settings (secrets redacted).",
      },
    },
  )

  .put(
    '/teams/:teamId/notification-settings',
    async ({ membership, body }) =>
      withSystemAvailability(await setNotificationSettings(membership.teamId, body)),
    {
      teamOwner: true,
      params: teamParams,
      body: NotificationSettingsBody,
      response: { 200: NotificationSettingsResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: 'Update notification provider settings',
        description: "Update a team's notification provider settings.",
      },
    },
  );
