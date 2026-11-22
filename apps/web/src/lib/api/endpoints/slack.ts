import { request } from '@/lib/api/core/client';

// A Slack app notifications go through, as read from the API: the secrets are never
// returned, only flags telling whether a value is stored. `slackTeamName` is the Slack
// workspace the bot token belongs to; `redirectUrl` is the address the app lists among
// its redirect URLs. The instance app is read in god mode, a workspace's own app on the
// workspace.
export interface SlackApp {
  hasBotToken: boolean;
  clientId: string;
  hasClientSecret: boolean;
  slackTeamName: string;
  redirectUrl: string;
}

// A secret left out or empty keeps its stored value.
export interface SlackAppPatch {
  botToken?: string;
  clientId?: string;
  clientSecret?: string;
}

// The session member's Slack account for a project: `slackTeamName` is the Slack
// workspace its notifications go to, null while Slack is off for the project.
export interface SlackAccount {
  slackTeamName: string | null;
  link: { name: string | null; linkedAt: string } | null;
}

export const getSlackAccount = (projectKey: string) =>
  request<SlackAccount>(`/projects/${projectKey}/slack/account`);

// The Sign in with Slack address that completes the connection.
export const startSlackLink = (projectKey: string) =>
  request<{ url: string }>(`/projects/${projectKey}/slack/account/link`, { method: 'POST' });

export const unlinkSlackAccount = (projectKey: string) =>
  request<void>(`/projects/${projectKey}/slack/account`, { method: 'DELETE' });

// Takes what Slack sent back to the redirect URL; answers with the project the
// connection was started from.
export const completeSlackLink = (input: { code: string; state: string }) =>
  request<{ projectRef: string }>('/slack/account/complete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
