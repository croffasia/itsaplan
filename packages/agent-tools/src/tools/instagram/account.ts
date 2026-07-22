import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest } from './client';

const DEFAULT_PROFILE_FIELDS =
  'id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count';

const DEFAULT_MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

// Reads the connected account's own profile.
export const instagramGetAccount: CustomToolEntry = {
  key: 'instagram_get_account',
  scopes: ['instagram_basic'],
  label: 'Instagram Get Account',
  description:
    "Read the connected Instagram Business/Creator account's own profile (username, name, bio, website, follower/follows/media counts, profile picture).",
  inputSchema: z.object({
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated fields to return. Defaults to ${DEFAULT_PROFILE_FIELDS}.`),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', igUserId, {
      fields: input.fields ? String(input.fields) : DEFAULT_PROFILE_FIELDS,
    });
  },
};

// Lists the account's own published media.
export const instagramListMedia: CustomToolEntry = {
  key: 'instagram_list_media',
  scopes: ['instagram_basic'],
  label: 'Instagram List Media',
  description:
    "List the connected account's own published media (posts, reels), most recent first, with pagination cursors.",
  inputSchema: z.object({
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated media fields. Defaults to ${DEFAULT_MEDIA_FIELDS}.`),
    limit: z.number().optional().describe('Max items per page (default 25).'),
    after: z
      .string()
      .optional()
      .describe('Pagination cursor from a previous call, to fetch the next page.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${igUserId}/media`, {
      fields: input.fields ? String(input.fields) : DEFAULT_MEDIA_FIELDS,
      limit: input.limit,
      after: input.after,
    });
  },
};

// Lists the account's active stories.
export const instagramListStories: CustomToolEntry = {
  key: 'instagram_list_stories',
  scopes: ['instagram_basic'],
  label: 'Instagram List Stories',
  description:
    "List the connected account's currently active stories (live for the last 24 hours).",
  inputSchema: z.object({
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated media fields. Defaults to ${DEFAULT_MEDIA_FIELDS}.`),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${igUserId}/stories`, {
      fields: input.fields ? String(input.fields) : DEFAULT_MEDIA_FIELDS,
    });
  },
};

// Lists media where the account is tagged by other users.
export const instagramListTaggedMedia: CustomToolEntry = {
  key: 'instagram_list_tagged_media',
  scopes: ['instagram_basic'],
  label: 'Instagram List Tagged Media',
  description: 'List media in which the connected account has been tagged by other users.',
  inputSchema: z.object({
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated media fields. Defaults to ${DEFAULT_MEDIA_FIELDS}.`),
    limit: z.number().optional().describe('Max items per page (default 25).'),
    after: z.string().optional().describe('Pagination cursor from a previous call.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${igUserId}/tags`, {
      fields: input.fields ? String(input.fields) : DEFAULT_MEDIA_FIELDS,
      limit: input.limit,
      after: input.after,
    });
  },
};

// Lists the account's active live video media.
export const instagramListLiveMedia: CustomToolEntry = {
  key: 'instagram_list_live_media',
  scopes: ['instagram_basic'],
  label: 'Instagram List Live Media',
  description: "List the connected account's currently active live video broadcasts.",
  inputSchema: z.object({
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated media fields. Defaults to ${DEFAULT_MEDIA_FIELDS}.`),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${igUserId}/live_media`, {
      fields: input.fields ? String(input.fields) : DEFAULT_MEDIA_FIELDS,
    });
  },
};

// Reads the remaining share quota in the 24-hour publishing window.
export const instagramContentPublishingLimit: CustomToolEntry = {
  key: 'instagram_content_publishing_limit',
  scopes: ['instagram_basic', 'instagram_content_publish'],
  label: 'Instagram Content Publishing Limit',
  description:
    'Read how many containers the account has published in the rolling 24-hour window (quota_usage) and the allowed quota (config.quota_total / config.quota_duration). Check before bulk publishing.',
  inputSchema: z.object({
    fields: z.string().optional().describe('Fields to return. Defaults to config,quota_usage.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${igUserId}/content_publishing_limit`, {
      fields: input.fields ? String(input.fields) : 'config,quota_usage',
    });
  },
};

// Lists hashtags the account recently searched (counts against the 30/7-day cap).
export const instagramRecentlySearchedHashtags: CustomToolEntry = {
  key: 'instagram_recently_searched_hashtags',
  scopes: ['instagram_basic', 'instagram_manage_insights'],
  label: 'Instagram Recently Searched Hashtags',
  description:
    'List hashtags the account has searched in the last 7 days. The account may query at most 30 unique hashtags per rolling 7-day period.',
  inputSchema: z.object({
    limit: z.number().optional().describe('Max items per page (default 25).'),
    after: z.string().optional().describe('Pagination cursor from a previous call.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${igUserId}/recently_searched_hashtags`, {
      limit: input.limit,
      after: input.after,
    });
  },
};
