import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest, MEDIA_FIELDS } from './client';

// A single Threads media object (post or reply) by its id.
export const threadsGetPost: CustomToolEntry = {
  key: 'threads_get_post',
  label: 'Threads Get Post',
  scopes: ['threads_basic'],
  description: 'Get a single Threads post or reply by its media id, with its fields.',
  inputSchema: z.object({
    mediaId: z.string().min(1).describe('Media id of the post or reply.'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields to return. Defaults to a broad set.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    return threadsRequest('GET', String(input.mediaId), {
      fields: (input.fields as string) || MEDIA_FIELDS,
      access_token: token,
    });
  },
};
