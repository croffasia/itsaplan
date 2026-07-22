import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest, MEDIA_FIELDS } from './client';
import { timeFilter, toUnixSeconds } from '../time';

// Search public Threads posts by keyword or tag. Requires the token to carry the
// threads_keyword_search permission.
export const threadsKeywordSearch: CustomToolEntry = {
  key: 'threads_keyword_search',
  label: 'Threads Keyword Search',
  scopes: ['threads_basic', 'threads_keyword_search'],
  description:
    'Search public Threads posts by keyword or tag. Requires the threads_keyword_search permission. Returns matching posts.',
  inputSchema: z.object({
    q: z.string().min(1).describe('The search query.'),
    searchType: z.enum(['TOP', 'RECENT']).optional().describe('TOP (default) or RECENT.'),
    searchMode: z.enum(['KEYWORD', 'TAG']).optional().describe('KEYWORD (default) or TAG.'),
    mediaType: z
      .enum(['TEXT', 'IMAGE', 'VIDEO'])
      .optional()
      .describe('Restrict results to a media type.'),
    authorUsername: z
      .string()
      .optional()
      .describe("Restrict results to a given author's username."),
    since: timeFilter
      .optional()
      .describe(
        'Only posts at/after this time. A unix timestamp in seconds or a date string (e.g. "2026-06-14").',
      ),
    until: timeFilter
      .optional()
      .describe(
        'Only posts at/before this time. A unix timestamp in seconds or a date string (e.g. "2026-07-14").',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many results (default 25, max 100).'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields per post. Defaults to a broad set.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', 'keyword_search', {
      q: String(input.q),
      search_type: input.searchType as string | undefined,
      search_mode: input.searchMode as string | undefined,
      media_type: input.mediaType as string | undefined,
      author_username: input.authorUsername as string | undefined,
      since: toUnixSeconds(input.since as number | string | undefined),
      until: toUnixSeconds(input.until as number | string | undefined),
      limit: input.limit ?? 25,
      fields: (input.fields as string) || MEDIA_FIELDS,
      access_token: token,
    });
    return { data: body.data ?? [], paging: body.paging ?? null };
  },
};

// Search for locations to tag in a post (by name and/or coordinates). The returned
// location id is passed as locationId to threads_publish.
export const threadsLocationSearch: CustomToolEntry = {
  key: 'threads_location_search',
  label: 'Threads Location Search',
  scopes: ['threads_basic', 'threads_location_tagging'],
  description:
    'Search for locations to tag in a Threads post, by name and/or coordinates. Returns location objects whose id can be passed to threads_publish as locationId.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe('Location name to search for. Use this and/or a latitude+longitude pair.'),
    latitude: z
      .number()
      .optional()
      .describe('Latitude to search near (must be used with longitude).'),
    longitude: z
      .number()
      .optional()
      .describe('Longitude to search near (must be used with latitude).'),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated fields per location. Default: id,name,address,city,country,latitude,longitude,postal_code.',
      ),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', 'location_search', {
      query: input.query as string | undefined,
      latitude: input.latitude,
      longitude: input.longitude,
      fields:
        (input.fields as string) || 'id,name,address,city,country,latitude,longitude,postal_code',
      access_token: token,
    });
    return { data: body.data ?? [], paging: body.paging ?? null };
  },
};
