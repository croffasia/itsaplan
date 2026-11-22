import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { slackCall } from './client';

interface SlackChannel {
  id?: string;
  name?: string;
  is_private?: boolean;
  is_member?: boolean;
  num_members?: number;
  topic?: { value?: string };
}

export const slackListChannels: CustomToolEntry = {
  key: 'slack_list_channels',
  label: 'Slack List Channels',
  description:
    'List the channels of the Slack workspace with their ids. The other Slack tools take a channel id. isMember tells whether the bot is in the channel: it reads and posts only where it is.',
  scopes: ['channels:read', 'groups:read'],
  inputSchema: z.object({
    includePrivate: z
      .boolean()
      .optional()
      .describe('Also list the private channels the bot is in.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('Channels per page, 100 by default.'),
    cursor: z.string().optional().describe('nextCursor of the previous page.'),
  }),
  execute: async (credential, input) => {
    const data = await slackCall(credential, 'conversations.list', {
      types: input.includePrivate ? 'public_channel,private_channel' : 'public_channel',
      exclude_archived: true,
      limit: input.limit ?? 100,
      cursor: input.cursor,
    });
    const channels = (data.channels as SlackChannel[] | undefined) ?? [];
    return {
      channels: channels.map((c) => ({
        id: c.id,
        name: c.name,
        isPrivate: Boolean(c.is_private),
        isMember: Boolean(c.is_member),
        members: c.num_members ?? null,
        topic: c.topic?.value || null,
      })),
      nextCursor: data.response_metadata?.next_cursor || null,
    };
  },
};
