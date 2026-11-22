import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { slackCall } from './client';

interface SlackUser {
  id?: string;
  name?: string;
  real_name?: string;
  tz?: string;
  profile?: { display_name?: string };
}

export const slackFindUser: CustomToolEntry = {
  key: 'slack_find_user',
  label: 'Slack Find User by Email',
  description:
    'Find a member of the Slack workspace by email. Their id is what slack_send_message takes as the channel for a direct message, and what <@id> mentions.',
  scopes: ['users:read', 'users:read.email'],
  inputSchema: z.object({
    email: z.string().email().describe('The email of the member.'),
  }),
  execute: async (credential, input) => {
    const data = await slackCall(credential, 'users.lookupByEmail', { email: input.email });
    const u = (data.user ?? {}) as SlackUser;
    return {
      id: u.id,
      name: u.real_name || u.name || null,
      displayName: u.profile?.display_name || null,
      timezone: u.tz ?? null,
    };
  },
};
