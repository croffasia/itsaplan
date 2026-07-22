import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest } from './client';

const PROFILE_FIELDS = 'id,username,name,threads_profile_picture_url,threads_biography,is_verified';

// The token owner's Threads profile.
export const threadsGetProfile: CustomToolEntry = {
  key: 'threads_get_profile',
  label: 'Threads Get Profile',
  scopes: ['threads_basic'],
  description: 'Get your Threads profile: id, username, name, biography, and profile picture URL.',
  inputSchema: z.object({
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated fields to return. Default: ${PROFILE_FIELDS}.`),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    return threadsRequest('GET', 'me', {
      fields: (input.fields as string) || PROFILE_FIELDS,
      access_token: token,
    });
  },
};
