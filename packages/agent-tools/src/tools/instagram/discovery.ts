import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest } from './client';
import { timeFilter, toUnixSeconds } from '../time';

const DEFAULT_DISCOVERY_MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_url,media_type,thumbnail_url}';

// Reads a public Business/Creator account by username via Business Discovery.
// Requires instagram_manage_insights on the token. The account being read is not
// involved and grants nothing; only public data is returned.
export const instagramBusinessDiscovery: CustomToolEntry = {
  key: 'instagram_business_discovery',
  scopes: ['instagram_basic', 'instagram_manage_insights'],
  label: 'Instagram Business Discovery',
  description:
    'Read another public Instagram Business/Creator account by username: profile stats and recent media. Does not work for personal accounts. Requires the instagram_manage_insights permission on the token.',
  inputSchema: z.object({
    username: z
      .string()
      .describe("The target account's Instagram username (must be a Business/Creator account)."),
    profileFields: z
      .string()
      .optional()
      .describe(
        'Profile fields to return: any of id, username, name, biography, website, profile_picture_url, followers_count, follows_count, media_count. Defaults to username,name,followers_count,follows_count,media_count.',
      ),
    includeMedia: z.boolean().default(true).describe("Include the account's recent media."),
    mediaFields: z
      .string()
      .optional()
      .describe(
        `Comma-separated media fields when includeMedia is set. Defaults to ${DEFAULT_DISCOVERY_MEDIA_FIELDS}.`,
      ),
    mediaLimit: z.number().optional().describe('Max media items to return (default 25).'),
    after: z
      .string()
      .optional()
      .describe('Media pagination cursor (Business Discovery uses manual cursors).'),
    sinceUnix: timeFilter
      .optional()
      .describe(
        'Only return media posted at or after this time (server-side .since() filter). A unix timestamp in seconds or a date string (e.g. "2026-06-14").',
      ),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    const profileFields = input.profileFields
      ? String(input.profileFields)
      : 'username,name,followers_count,follows_count,media_count';

    let inner = profileFields;
    if (input.includeMedia !== false) {
      let mediaEdge = 'media';
      const sinceUnix = toUnixSeconds(input.sinceUnix as number | string | undefined);
      if (sinceUnix != null) mediaEdge += `.since(${sinceUnix})`;
      if (input.after) mediaEdge += `.after(${String(input.after)})`;
      if (input.mediaLimit != null) mediaEdge += `.limit(${Number(input.mediaLimit)})`;
      const mediaFields = input.mediaFields
        ? String(input.mediaFields)
        : DEFAULT_DISCOVERY_MEDIA_FIELDS;
      inner += `,${mediaEdge}{${mediaFields}}`;
    }

    const fields = `business_discovery.username(${String(input.username)}){${inner}}`;
    const body = await igRequest(token, 'GET', igUserId, { fields });
    return body.business_discovery ?? body;
  },
};
