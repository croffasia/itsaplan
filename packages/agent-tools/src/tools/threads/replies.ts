import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest, REPLY_FIELDS, PENDING_REPLY_FIELDS } from './client';
import { timeFilter, toUnixSeconds } from '../time';

// Top-level replies to a post.
export const threadsListReplies: CustomToolEntry = {
  key: 'threads_list_replies',
  label: 'Threads List Replies',
  scopes: ['threads_basic', 'threads_read_replies'],
  description: "List the top-level replies to a Threads post, by the post's media id.",
  inputSchema: z.object({
    mediaId: z.string().min(1).describe('Media id of the post whose replies to list.'),
    reverse: z
      .boolean()
      .optional()
      .describe('true for oldest-first, false (default) for newest-first.'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields per reply. Defaults to a broad set.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', `${String(input.mediaId)}/replies`, {
      fields: (input.fields as string) || REPLY_FIELDS,
      reverse: typeof input.reverse === 'boolean' ? input.reverse : undefined,
      access_token: token,
    });
    return { data: body.data ?? [], paging: body.paging ?? null };
  },
};

// The full nested conversation under a post (all replies at every depth). Only the
// post owner can read the complete conversation.
export const threadsGetConversation: CustomToolEntry = {
  key: 'threads_get_conversation',
  label: 'Threads Get Conversation',
  scopes: ['threads_basic', 'threads_read_replies'],
  description:
    "Get the full nested reply conversation under one of your posts, by the post's media id. Returns replies at all depths.",
  inputSchema: z.object({
    mediaId: z.string().min(1).describe('Media id of the post whose conversation to fetch.'),
    reverse: z
      .boolean()
      .optional()
      .describe('true for oldest-first, false (default) for newest-first.'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields per reply. Defaults to a broad set.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', `${String(input.mediaId)}/conversation`, {
      fields: (input.fields as string) || REPLY_FIELDS,
      reverse: typeof input.reverse === 'boolean' ? input.reverse : undefined,
      access_token: token,
    });
    return { data: body.data ?? [], paging: body.paging ?? null };
  },
};

// The token owner's own replies.
export const threadsListUserReplies: CustomToolEntry = {
  key: 'threads_list_user_replies',
  label: 'Threads List My Replies',
  scopes: ['threads_basic', 'threads_read_replies'],
  description: 'List your own Threads replies, newest first.',
  inputSchema: z.object({
    since: timeFilter
      .optional()
      .describe(
        'Only replies created at/after this time. A unix timestamp in seconds or a date string (e.g. "2026-06-14").',
      ),
    until: timeFilter
      .optional()
      .describe(
        'Only replies created at/before this time. A unix timestamp in seconds or a date string (e.g. "2026-07-14").',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many replies to return (default 25, max 100).'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields per reply. Defaults to a broad set.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', 'me/replies', {
      fields: (input.fields as string) || REPLY_FIELDS,
      since: toUnixSeconds(input.since as number | string | undefined),
      until: toUnixSeconds(input.until as number | string | undefined),
      limit: input.limit ?? 25,
      access_token: token,
    });
    return { data: body.data ?? [], paging: body.paging ?? null };
  },
};

// Pending replies awaiting approval on posts with a restricted reply audience.
export const threadsPendingReplies: CustomToolEntry = {
  key: 'threads_pending_replies',
  label: 'Threads List Pending Replies',
  scopes: ['threads_basic', 'threads_read_replies'],
  description:
    "List pending replies awaiting your approval on a post with a restricted reply audience, by the post's media id.",
  inputSchema: z.object({
    mediaId: z.string().min(1).describe('Media id of the post whose pending replies to list.'),
    reverse: z
      .boolean()
      .optional()
      .describe('true (default) for oldest-first, false for newest-first.'),
    approvalStatus: z
      .enum(['pending', 'ignored'])
      .optional()
      .describe('Filter by approval status.'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields per reply. Defaults to the pending-reply field set.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', `${String(input.mediaId)}/pending_replies`, {
      fields: (input.fields as string) || PENDING_REPLY_FIELDS,
      reverse: typeof input.reverse === 'boolean' ? input.reverse : undefined,
      approval_status: input.approvalStatus as string | undefined,
      access_token: token,
    });
    return { data: body.data ?? [], paging: body.paging ?? null };
  },
};
