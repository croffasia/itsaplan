import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { graphRequest, htmlToText, msCredential } from './client';

// Teams through application permissions can read teams, channels and channel
// messages. Posting a message as the app is not offered by Microsoft Graph outside
// data migration, so there is no send tool here.

export const microsoft365TeamsList: CustomToolEntry = {
  key: 'microsoft365_teams_list',
  label: 'Microsoft 365 List Teams',
  scopes: ['Team.ReadBasic.All', 'Channel.ReadBasic.All'],
  description:
    "List the Microsoft Teams teams in the organization. Pass a teamId to list that team's channels instead.",
  inputSchema: z.object({
    teamId: z.string().optional().describe('A team id, to list its channels.'),
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const teamId = String(input.teamId ?? '').trim();
    if (teamId) {
      const body = await graphRequest(cred, {
        path: `teams/${encodeURIComponent(teamId)}/channels`,
        permission: 'Channel.ReadBasic.All',
      });
      return {
        channels: (body.value ?? []).map((c) => ({
          id: String(c.id ?? ''),
          name: c.displayName ?? '',
          description: c.description ?? null,
          webUrl: c.webUrl ?? null,
        })),
      };
    }
    const body = await graphRequest(cred, {
      path: `teams?$top=100&$select=id,displayName,description`,
      permission: 'Team.ReadBasic.All',
    });
    return {
      teams: (body.value ?? []).map((t) => ({
        id: String(t.id ?? ''),
        name: t.displayName ?? '',
        description: t.description ?? null,
      })),
    };
  },
};

export const microsoft365TeamsMessages: CustomToolEntry = {
  key: 'microsoft365_teams_messages',
  label: 'Microsoft 365 Read Channel Messages',
  scopes: ['ChannelMessage.Read.All'],
  description: 'Read the newest messages of a Microsoft Teams channel, as text.',
  inputSchema: z.object({
    teamId: z.string().min(1).describe('The team id from microsoft365_teams_list.'),
    channelId: z.string().min(1).describe('The channel id from microsoft365_teams_list.'),
    limit: z.number().int().min(1).max(50).optional().describe('How many messages (default 20).'),
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const body = await graphRequest(cred, {
      path: `teams/${encodeURIComponent(String(input.teamId))}/channels/${encodeURIComponent(String(input.channelId))}/messages?$top=${Number(input.limit ?? 20)}`,
      permission: 'ChannelMessage.Read.All',
    });
    return {
      messages: (body.value ?? [])
        .filter((m) => m.messageType === 'message' && !m.deletedDateTime)
        .map((m) => {
          const content = m.body as { contentType?: string; content?: string } | undefined;
          const from = m.from as { user?: { displayName?: string } } | null;
          return {
            id: String(m.id ?? ''),
            from: from?.user?.displayName ?? null,
            sent: m.createdDateTime ?? null,
            text:
              content?.contentType === 'html'
                ? htmlToText(content.content ?? '')
                : (content?.content ?? ''),
            webUrl: m.webUrl ?? null,
          };
        }),
    };
  },
};
