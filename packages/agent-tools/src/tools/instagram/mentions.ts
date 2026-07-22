import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest } from './client';

// Replies to a mention of the account, either in a media caption or in a comment.
export const instagramReplyToMention: CustomToolEntry = {
  key: 'instagram_reply_to_mention',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Reply To Mention',
  description:
    'Reply to a place where the connected account was @mentioned. Provide mediaId to reply on the media (a caption mention), or commentId to reply to the mentioning comment.',
  inputSchema: z.object({
    message: z.string().min(1).describe('The reply text.'),
    mediaId: z.string().describe('The media id where the account was mentioned.'),
    commentId: z
      .string()
      .optional()
      .describe(
        'The mentioning comment id. Provide to reply to a comment mention; omit for a caption mention.',
      ),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'POST', `${igUserId}/mentions`, {
      media_id: String(input.mediaId),
      comment_id: input.commentId ? String(input.commentId) : undefined,
      message: String(input.message),
    });
  },
};

// Reads a comment that @mentioned the account.
export const instagramGetMentionedComment: CustomToolEntry = {
  key: 'instagram_get_mentioned_comment',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Get Mentioned Comment',
  description: 'Read a specific comment (by id) in which the connected account was @mentioned.',
  inputSchema: z.object({
    commentId: z.string().describe('The id of the comment that mentioned the account.'),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated comment fields. Defaults to id,text,username,timestamp,like_count.',
      ),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    const fields = input.fields ? String(input.fields) : 'id,text,username,timestamp,like_count';
    const body = await igRequest(token, 'GET', igUserId, {
      fields: `mentioned_comment.comment_id(${String(input.commentId)}){${fields}}`,
    });
    return body.mentioned_comment ?? body;
  },
};

// Reads a media object whose caption @mentioned the account.
export const instagramGetMentionedMedia: CustomToolEntry = {
  key: 'instagram_get_mentioned_media',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Get Mentioned Media',
  description:
    'Read a specific media object (by id) whose caption @mentioned the connected account.',
  inputSchema: z.object({
    mediaId: z.string().describe('The id of the media that mentioned the account in its caption.'),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated media fields. Defaults to id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count.',
      ),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    const fields = input.fields
      ? String(input.fields)
      : 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count';
    const body = await igRequest(token, 'GET', igUserId, {
      fields: `mentioned_media.media_id(${String(input.mediaId)}){${fields}}`,
    });
    return body.mentioned_media ?? body;
  },
};
