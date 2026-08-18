import { Elysia } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { accessErrors, commonErrors } from '#shared/responses';
import { getProjectEmailConfig } from '@repo/auth';
import { NotificationSettingsBody, NotificationSettingsResponse } from './model';
import {
  getNotificationSettings,
  setNotificationSettings,
  type NotificationSettingsDto,
} from './service';

// Adds whether the instance provider is available to projects right now. It is an
// instance setting, so it is reported alongside the project's own settings rather
// than stored with them.
async function withSystemAvailability(settings: NotificationSettingsDto) {
  return { ...settings, systemAvailable: (await getProjectEmailConfig()) !== null };
}

// Notification provider credentials carry secrets (SMTP password, Resend key,
// Telegram bot token), so they are managed only through the session UI and not
// exposed as MCP tools. Gated under the danger_zone resource, the project-level
// settings gate. A member's own delivery preferences live in notification-preferences.
export const notificationSettingsRoutes = new Elysia({
  name: 'notification-settings',
  detail: { tags: ['Settings'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/projects/:projectKey/notification-settings',
    async ({ project }) => withSystemAvailability(await getNotificationSettings(project.id)),
    {
      permission: ['danger_zone', 'read'],
      response: { 200: NotificationSettingsResponse, ...accessErrors },
      detail: {
        summary: 'Get notification provider settings',
        description: "Get a project's notification provider settings (secrets redacted).",
      },
    },
  )

  .put(
    '/projects/:projectKey/notification-settings',
    async ({ project, body }) =>
      withSystemAvailability(await setNotificationSettings(project.id, body)),
    {
      body: NotificationSettingsBody,
      permission: ['danger_zone', 'edit'],
      response: { 200: NotificationSettingsResponse, ...commonErrors },
      detail: {
        summary: 'Update notification provider settings',
        description: "Update a project's notification provider settings.",
      },
    },
  );
