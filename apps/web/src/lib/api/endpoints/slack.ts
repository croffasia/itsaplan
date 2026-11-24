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

// The session user's account in one Slack workspace. `available` says whether one of their
// projects sends to it; a connection outlives that until it is disconnected.
export interface SlackAccount {
  slackTeamId: string;
  slackTeamName: string | null;
  available: boolean;
  link: { name: string | null; linkedAt: string } | null;
}

export const listSlackAccounts = () => request<SlackAccount[]>('/slack/accounts');

// The Sign in with Slack address that completes the connection.
export const startSlackLink = (slackTeamId: string) =>
  request<{ url: string }>(`/slack/accounts/${slackTeamId}/link`, { method: 'POST' });

export const unlinkSlackAccount = (slackTeamId: string) =>
  request<void>(`/slack/accounts/${slackTeamId}`, { method: 'DELETE' });

// Takes what Slack sent back to the redirect URL.
export const completeSlackLink = (input: { code: string; state: string }) =>
  request<void>('/slack/accounts/complete', { method: 'POST', body: JSON.stringify(input) });
