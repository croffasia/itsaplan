import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { slackCall } from './client';

export const slackSendMessage: CustomToolEntry = {
  key: 'slack_send_message',
  label: 'Slack Send Message',
  description:
    'Post a message to a Slack channel, or to a person as a direct message from the bot. The text uses Slack mrkdwn: *bold*, _italic_, `code`, <https://example.com|link text>, <@U123> to mention a user. Pass threadTs to reply in a thread.',
  scopes: ['chat:write'],
  inputSchema: z.object({
    channel: z
      .string()
      .optional()
      .describe(
        'Channel id (C…), or a user id (U…) for a direct message. Omit to use the configured default channel.',
      ),
    text: z.string().min(1).describe('The message text, in Slack mrkdwn.'),
    threadTs: z
      .string()
      .optional()
      .describe('The ts of the message that starts the thread, to reply in that thread.'),
  }),
  execute: async (credential, input) => {
    const channel = String(input.channel || credential.defaultChannel || '');
    if (!channel) throw new Error('No channel given and no default channel configured.');
    const data = await slackCall(
      credential,
      'chat.postMessage',
      { channel, text: String(input.text), thread_ts: input.threadTs || undefined },
      { post: true },
    );
    return { sent: true, channel: data.channel, ts: data.ts };
  },
};
