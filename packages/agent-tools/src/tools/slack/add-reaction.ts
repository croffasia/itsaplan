import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { SlackApiError, slackCall } from './client';

export const slackAddReaction: CustomToolEntry = {
  key: 'slack_add_reaction',
  label: 'Slack Add Reaction',
  description: 'Add an emoji reaction from the bot to a Slack message.',
  scopes: ['reactions:write'],
  inputSchema: z.object({
    channel: z.string().min(1).describe('Channel id (C…) of the message.'),
    ts: z.string().min(1).describe('The ts of the message.'),
    emoji: z.string().min(1).describe('Emoji name without colons, e.g. "white_check_mark".'),
  }),
  execute: async (credential, input) => {
    try {
      await slackCall(
        credential,
        'reactions.add',
        {
          channel: input.channel,
          timestamp: input.ts,
          name: String(input.emoji).replace(/^:|:$/g, ''),
        },
        { post: true },
      );
    } catch (err) {
      // The reaction the model asked for is there, so the call did what it should.
      if (!(err instanceof SlackApiError && err.code === 'already_reacted')) throw err;
    }
    return { added: true };
  },
};
