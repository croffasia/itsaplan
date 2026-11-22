import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { messagesOf, slackCall } from './client';

export const slackGetThread: CustomToolEntry = {
  key: 'slack_get_thread',
  label: 'Slack Get Thread',
  description:
    'Read a Slack thread: the message that starts it, then its replies, oldest first. Reply to it with slack_send_message and threadTs.',
  scopes: ['channels:history', 'groups:history'],
  inputSchema: z.object({
    channel: z.string().min(1).describe('Channel id (C…).'),
    ts: z.string().min(1).describe('The ts of the message that starts the thread.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('Messages per page, 50 by default.'),
    cursor: z.string().optional().describe('nextCursor of the previous page.'),
  }),
  execute: async (credential, input) =>
    messagesOf(
      await slackCall(credential, 'conversations.replies', {
        channel: input.channel,
        ts: input.ts,
        limit: input.limit ?? 50,
        cursor: input.cursor,
      }),
    ),
};
