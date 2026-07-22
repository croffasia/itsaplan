import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest } from './client';

const DEFAULT_COMMENT_FIELDS = 'id,text,username,timestamp,like_count,hidden';

// Lists top-level comments on a media object.
export const instagramListComments: CustomToolEntry = {
  key: 'instagram_list_comments',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram List Comments',
  description: 'List top-level comments on a media object, with pagination cursors.',
  inputSchema: z.object({
    mediaId: z.string().describe('The IG media id.'),
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated comment fields. Defaults to ${DEFAULT_COMMENT_FIELDS}.`),
    limit: z.number().optional().describe('Max comments per page (default 25).'),
    after: z.string().optional().describe('Pagination cursor from a previous call.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'GET', `${String(input.mediaId)}/comments`, {
      fields: input.fields ? String(input.fields) : DEFAULT_COMMENT_FIELDS,
      limit: input.limit,
      after: input.after,
    });
  },
};

// Posts a top-level comment on a media object.
export const instagramCreateComment: CustomToolEntry = {
  key: 'instagram_create_comment',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Create Comment',
  description:
    "Post a top-level comment on a media object (the connected account's own or another public post).",
  inputSchema: z.object({
    mediaId: z.string().describe('The IG media id to comment on.'),
    message: z.string().min(1).describe('The comment text.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'POST', `${String(input.mediaId)}/comments`, {
      message: String(input.message),
    });
  },
};

// Reads a single comment by id.
export const instagramGetComment: CustomToolEntry = {
  key: 'instagram_get_comment',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Get Comment',
  description: 'Read a single comment by its id.',
  inputSchema: z.object({
    commentId: z.string().describe('The IG comment id.'),
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated fields. Defaults to ${DEFAULT_COMMENT_FIELDS},parent_id.`),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'GET', String(input.commentId), {
      fields: input.fields ? String(input.fields) : `${DEFAULT_COMMENT_FIELDS},parent_id`,
    });
  },
};

// Lists replies to a comment.
export const instagramListCommentReplies: CustomToolEntry = {
  key: 'instagram_list_comment_replies',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram List Comment Replies',
  description: 'List the replies to a comment.',
  inputSchema: z.object({
    commentId: z.string().describe('The parent IG comment id.'),
    fields: z
      .string()
      .optional()
      .describe(`Comma-separated comment fields. Defaults to ${DEFAULT_COMMENT_FIELDS}.`),
    limit: z.number().optional().describe('Max replies per page (default 25).'),
    after: z.string().optional().describe('Pagination cursor from a previous call.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'GET', `${String(input.commentId)}/replies`, {
      fields: input.fields ? String(input.fields) : DEFAULT_COMMENT_FIELDS,
      limit: input.limit,
      after: input.after,
    });
  },
};

// Replies to a comment.
export const instagramReplyToComment: CustomToolEntry = {
  key: 'instagram_reply_to_comment',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Reply To Comment',
  description: 'Post a reply to an existing comment.',
  inputSchema: z.object({
    commentId: z.string().describe('The IG comment id to reply to.'),
    message: z.string().min(1).describe('The reply text.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'POST', `${String(input.commentId)}/replies`, {
      message: String(input.message),
    });
  },
};

// Hides or unhides a comment on the account's own media.
export const instagramHideComment: CustomToolEntry = {
  key: 'instagram_hide_comment',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Hide Comment',
  description: "Hide or unhide a comment on one of the connected account's own media.",
  inputSchema: z.object({
    commentId: z.string().describe('The IG comment id.'),
    hide: z.boolean().describe('true to hide the comment, false to unhide it.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'POST', String(input.commentId), {
      hide: input.hide ? 'true' : 'false',
    });
  },
};

// Deletes a comment on the account's own media.
export const instagramDeleteComment: CustomToolEntry = {
  key: 'instagram_delete_comment',
  scopes: ['instagram_basic', 'instagram_manage_comments'],
  label: 'Instagram Delete Comment',
  description:
    "Delete a comment on one of the connected account's own media. This cannot be undone.",
  inputSchema: z.object({
    commentId: z.string().describe('The IG comment id to delete.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'DELETE', String(input.commentId));
  },
};
