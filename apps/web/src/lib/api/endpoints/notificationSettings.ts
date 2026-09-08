import { request } from '@/lib/api/core/client';

// Per-team notification provider credentials (owner-managed) plus a member's own
// delivery preferences for a project. The issue events match the inbox notification
// types.
export type NotificationEncryption = 'none' | 'ssl' | 'tls';

export interface NotificationEventToggles {
  assigned: boolean;
  mentioned: boolean;
  commented: boolean;
  state_changed: boolean;
}

// The provider credentials as read from the API: secrets are never returned, only a
// `hasX` flag telling whether a value is stored.
export interface NotificationSettings {
  // Deliver email through the instance provider instead of the team's own. Its
  // credentials belong to the instance, so the team only turns it on.
  system: { enabled: boolean };
  // Whether the instance provider exists and is shared with teams right now.
  systemAvailable: boolean;
  smtp: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: NotificationEncryption;
    username: string;
    hasPassword: boolean;
    timeout: number | null;
  };
  resend: { enabled: boolean; hasApiKey: boolean };
  telegram: { enabled: boolean; hasBotToken: boolean };
}

// A partial write. Each section is optional so a provider card saves on its own.
// A secret field left out or empty keeps its stored value.
export interface NotificationSettingsPatch {
  system?: { enabled: boolean };
  smtp?: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: NotificationEncryption;
    username: string;
    password?: string;
    timeout: number | null;
  };
  resend?: { enabled: boolean; apiKey?: string };
  telegram?: { enabled: boolean; botToken?: string };
}

// The team's notification provider credentials, shared by every project it owns
// (team owner only).
export const getNotificationSettings = (teamId: number) =>
  request<NotificationSettings>(`/teams/${teamId}/notification-settings`);

export const setNotificationSettings = (teamId: number, input: NotificationSettingsPatch) =>
  request<NotificationSettings>(`/teams/${teamId}/notification-settings`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
