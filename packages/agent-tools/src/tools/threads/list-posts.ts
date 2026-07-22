import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest, MEDIA_FIELDS } from './client';
import { timeFilter, toUnixSeconds } from '../time';

// List the token owner's own posts, most recent first, optionally windowed by a
// created-time range (unix seconds).
export const threadsListPosts: CustomToolEntry = {
  key: 'threads_list_posts',
  label: 'Threads List My Posts',
  scopes: ['threads_basic'],
  description:
    'List your own Threads posts, newest first. Optionally filter by a created-time range.',
  inputSchema: z.object({
    since: timeFilter
      .optional()
      .describe(
        'Only posts created at/after this time. A unix timestamp in seconds or a date string (e.g. "2026-06-14").',
      ),
    until: timeFilter
      .optional()
      .describe(
        'Only posts created at/before this time. A unix timestamp in seconds or a date string (e.g. "2026-07-14").',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many posts to return (default 25, max 100).'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields to return per post. Defaults to a broad set.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', 'me/threads', {
      fields: (input.fields as string) || MEDIA_FIELDS,
      since: toUnixSeconds(input.since as number | string | undefined),
      until: toUnixSeconds(input.until as number | string | undefined),
      limit: input.limit ?? 25,
      access_token: token,
    });
    return { data: body.data ?? [], paging: body.paging ?? null };
  },
};
