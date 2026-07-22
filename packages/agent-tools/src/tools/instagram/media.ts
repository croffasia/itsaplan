import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest } from './client';

const DEFAULT_MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,shortcode,timestamp,username,like_count,comments_count,is_comment_enabled';

// Reads a single media object by id.
export const instagramGetMedia: CustomToolEntry = {
  key: 'instagram_get_media',
  scopes: ['instagram_basic'],
  label: 'Instagram Get Media',
  description: 'Read a single Instagram media object (post, reel, story) by its media id.',
  inputSchema: z.object({
    mediaId: z.string().describe('The IG media id.'),
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated media fields. Defaults to ${DEFAULT_MEDIA_FIELDS}.`),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'GET', String(input.mediaId), {
      fields: input.fields ? String(input.fields) : DEFAULT_MEDIA_FIELDS,
    });
  },
};

// Lists the child media of a carousel album.
export const instagramMediaChildren: CustomToolEntry = {
  key: 'instagram_media_children',
  scopes: ['instagram_basic'],
  label: 'Instagram Media Children',
  description: 'List the child media (photos/videos) of a carousel album post.',
  inputSchema: z.object({
    mediaId: z.string().describe('The IG media id of a CAROUSEL_ALBUM.'),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated fields. Defaults to id,media_type,media_url,thumbnail_url,permalink,timestamp.',
      ),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'GET', `${String(input.mediaId)}/children`, {
      fields: input.fields
        ? String(input.fields)
        : 'id,media_type,media_url,thumbnail_url,permalink,timestamp',
    });
  },
};

// Toggles comments on one of the account's own media.
export const instagramUpdateMedia: CustomToolEntry = {
  key: 'instagram_update_media',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Update Media',
  description: "Enable or disable comments on one of the connected account's own media.",
  inputSchema: z.object({
    mediaId: z.string().describe('The IG media id (must be owned by the connected account).'),
    commentEnabled: z.boolean().describe('true to allow comments, false to turn them off.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'POST', String(input.mediaId), {
      comment_enabled: input.commentEnabled ? 'true' : 'false',
    });
  },
};

// Deletes one of the account's own media.
export const instagramDeleteMedia: CustomToolEntry = {
  key: 'instagram_delete_media',
  scopes: ['instagram_basic', 'instagram_content_publish'],
  label: 'Instagram Delete Media',
  description:
    "Permanently delete one of the connected account's own media (posts/reels). This cannot be undone.",
  inputSchema: z.object({
    mediaId: z
      .string()
      .describe('The IG media id to delete (must be owned by the connected account).'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'DELETE', String(input.mediaId));
  },
};
