import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest } from './client';

// Hide or unhide a reply to one of the token owner's posts.
export const threadsManageReply: CustomToolEntry = {
  key: 'threads_manage_reply',
  label: 'Threads Hide/Unhide Reply',
  scopes: ['threads_basic', 'threads_manage_replies'],
  description: "Hide or unhide a reply to one of your posts, by the reply's media id.",
  inputSchema: z.object({
    replyId: z.string().min(1).describe('Media id of the reply to hide or unhide.'),
    hide: z.boolean().describe('true to hide the reply, false to unhide it.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('POST', `${String(input.replyId)}/manage_reply`, {
      hide: input.hide === true,
      access_token: token,
    });
    return {
      success: body.success ?? true,
      replyId: String(input.replyId),
      hidden: input.hide === true,
    };
  },
};

// Approve or reject a pending reply on a post whose reply audience is restricted.
export const threadsManagePendingReply: CustomToolEntry = {
  key: 'threads_manage_pending_reply',
  label: 'Threads Approve/Reject Pending Reply',
  scopes: ['threads_basic', 'threads_manage_replies'],
  description:
    "Approve or reject a pending reply (on a post with a restricted reply audience), by the reply's media id.",
  inputSchema: z.object({
    replyId: z.string().min(1).describe('Media id of the pending reply.'),
    approve: z.boolean().describe('true to approve the pending reply, false to reject it.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('POST', `${String(input.replyId)}/manage_pending_reply`, {
      approve: input.approve === true,
      access_token: token,
    });
    return {
      success: body.success ?? true,
      replyId: String(input.replyId),
      approved: input.approve === true,
    };
  },
};
