import { request } from '@/lib/api/core/client';

// The issue events match the inbox notification types.
export interface NotificationEventToggles {
  assigned: boolean;
  mentioned: boolean;
  commented: boolean;
  state_changed: boolean;
  reacted: boolean;
}

// Which issue events go to each channel. Email is sent to the account address, Telegram to
// the linked account, Slack to the account connected in the Slack workspace the project
// sends to, push to every browser the user turned it on in.
export interface NotificationPreferences {
  emailEvents: NotificationEventToggles;
  telegramEvents: NotificationEventToggles;
  slackEvents: NotificationEventToggles;
  pushEvents: NotificationEventToggles;
}

export interface ProjectNotificationPreferences {
  id: number;
  name: string;
  team: { id: number; name: string };
  // The Slack workspace the project sends to, null while Slack is off for it.
  slackTeamId: string | null;
  // Null while the project follows the defaults.
  preferences: NotificationPreferences | null;
}

export interface AccountNotificationPreferences {
  defaults: NotificationPreferences;
  projects: ProjectNotificationPreferences[];
}

// What is left out keeps its value; a project with null preferences returns to the
// defaults. `resetProjects` returns every project to them, archived ones and those the user
// left included, which the list does not show.
export interface AccountNotificationPreferencesPatch {
  defaults?: NotificationPreferences;
  resetProjects?: boolean;
  projects?: { projectId: number; preferences: NotificationPreferences | null }[];
}

// The session user's own notification preferences, for every project they are a member of.
export const getNotificationPreferences = () =>
  request<AccountNotificationPreferences>('/account/notification-preferences');

export const updateNotificationPreferences = (patch: AccountNotificationPreferencesPatch) =>
  request<void>('/account/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
