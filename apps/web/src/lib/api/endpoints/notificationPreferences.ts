import { request } from '@/lib/api/core/client';
import type { NotificationEventToggles } from '@/lib/api/endpoints/notificationSettings';

// The session member's own notification preferences for a project: which issue
// events they want by email, Telegram, Slack and/or push. Email is sent to the member's
// account address, Telegram to the account they linked in their profile, Slack to the
// account they connected in the project's notification settings, push to every browser
// they turned it on in.
export interface NotificationPreferences {
  emailEvents: NotificationEventToggles;
  telegramEvents: NotificationEventToggles;
  slackEvents: NotificationEventToggles;
  pushEvents: NotificationEventToggles;
}

// The session member's own notification preferences for a project (any member).
export const getNotificationPreferences = (projectKey: string) =>
  request<NotificationPreferences>(`/projects/${projectKey}/notification-preferences`);

export const setNotificationPreferences = (projectKey: string, input: NotificationPreferences) =>
  request<NotificationPreferences>(`/projects/${projectKey}/notification-preferences`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
