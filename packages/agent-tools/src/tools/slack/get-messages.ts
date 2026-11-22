import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { messagesOf, slackCall } from './client';

export const slackGetMessages: CustomToolEntry = {
  key: 'slack_get_messages',
  label: 'Slack Get Messages',
  description:
    'Read the latest messages of a Slack channel the bot is in, newest first. A message with replyCount above 0 starts a thread: read it with slack_get_thread.',
  scopes: ['channels:history', 'groups:history'],
  inputSchema: z.object({
    channel: z.string().min(1).describe('Channel id (C…).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Messages per page, 20 by default.'),
    oldest: z.string().optional().describe('Only messages after this ts.'),
    latest: z.string().optional().describe('Only messages before this ts.'),
    cursor: z.string().optional().describe('nextCursor of the previous page.'),
  }),
  execute: async (credential, input) =>
    messagesOf(
      await slackCall(credential, 'conversations.history', {
        channel: input.channel,
        limit: input.limit ?? 20,
        oldest: input.oldest,
        latest: input.latest,
        cursor: input.cursor,
      }),
    ),
};
