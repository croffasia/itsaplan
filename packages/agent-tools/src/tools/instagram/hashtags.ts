import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest } from './client';

const DEFAULT_HASHTAG_MEDIA_FIELDS =
  'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count';

// Resolves a hashtag name to its id, needed by the media edges below. The account
// may query at most 30 unique hashtags per rolling 7-day period.
export const instagramHashtagSearch: CustomToolEntry = {
  key: 'instagram_hashtag_search',
  scopes: ['instagram_basic', 'instagram_manage_insights'],
  label: 'Instagram Hashtag Search',
  description:
    "Resolve a hashtag name to its id, needed by the top/recent media tools. Counts against the account's limit of 30 unique hashtags per rolling 7-day period.",
  inputSchema: z.object({
    hashtag: z.string().describe("The hashtag name, without the leading '#'."),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', 'ig_hashtag_search', {
      user_id: igUserId,
      q: String(input.hashtag),
    });
  },
};

// Reads the most popular media for a hashtag.
export const instagramHashtagTopMedia: CustomToolEntry = {
  key: 'instagram_hashtag_top_media',
  scopes: ['instagram_basic', 'instagram_manage_insights'],
  label: 'Instagram Hashtag Top Media',
  description:
    'Read the most popular public media tagged with a hashtag. Pass a hashtag id from instagram_hashtag_search.',
  inputSchema: z.object({
    hashtagId: z.string().describe('The hashtag id from instagram_hashtag_search.'),
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated media fields. Defaults to ${DEFAULT_HASHTAG_MEDIA_FIELDS}.`),
    limit: z.number().optional().describe('Max items per page (max 50).'),
    after: z.string().optional().describe('Pagination cursor from a previous call.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${String(input.hashtagId)}/top_media`, {
      user_id: igUserId,
      fields: input.fields ? String(input.fields) : DEFAULT_HASHTAG_MEDIA_FIELDS,
      limit: input.limit,
      after: input.after,
    });
  },
};

// Reads recent media for a hashtag (published within the last 24 hours).
export const instagramHashtagRecentMedia: CustomToolEntry = {
  key: 'instagram_hashtag_recent_media',
  scopes: ['instagram_basic', 'instagram_manage_insights'],
  label: 'Instagram Hashtag Recent Media',
  description:
    'Read the most recent public media tagged with a hashtag (only media from the last 24 hours). Pass a hashtag id from instagram_hashtag_search.',
  inputSchema: z.object({
    hashtagId: z.string().describe('The hashtag id from instagram_hashtag_search.'),
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated media fields. Defaults to ${DEFAULT_HASHTAG_MEDIA_FIELDS}.`),
    limit: z.number().optional().describe('Max items per page (max 50).'),
    after: z.string().optional().describe('Pagination cursor from a previous call.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${String(input.hashtagId)}/recent_media`, {
      user_id: igUserId,
      fields: input.fields ? String(input.fields) : DEFAULT_HASHTAG_MEDIA_FIELDS,
      limit: input.limit,
      after: input.after,
    });
  },
};
