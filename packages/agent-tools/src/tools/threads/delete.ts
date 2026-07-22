import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest } from './client';

// Delete one of the token owner's own Threads posts or replies.
export const threadsDelete: CustomToolEntry = {
  key: 'threads_delete',
  label: 'Threads Delete Post',
  scopes: ['threads_basic', 'threads_delete'],
  description: 'Delete one of your own Threads posts or replies by its media id.',
  inputSchema: z.object({
    mediaId: z.string().min(1).describe('Media id of the post or reply to delete.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    await threadsRequest('DELETE', String(input.mediaId), { access_token: token });
    return { deleted: true, mediaId: String(input.mediaId) };
  },
};
