import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { notionId, notionRequest, notionToken } from './client';

// Comments on a page: a new thread on the page itself, or a reply into an existing
// discussion read with notion_read_comments.
export const notionAddComment: CustomToolEntry = {
  key: 'notion_add_comment',
  label: 'Notion Add Comment',
  scopes: ['Insert comments'],
  description:
    'Comment on a Notion page. Give a pageId to start a new comment on the page, or a discussionId from notion_read_comments to reply inside that thread. A comment carries inline formatting only: bold, italic, strikethrough, code and links.',
  inputSchema: z.object({
    pageId: z.string().optional().describe('Page to comment on. Starts a new thread.'),
    discussionId: z.string().optional().describe('Thread to reply into.'),
    text: z.string().min(1).describe('The comment text, as markdown.'),
  }),
  execute: async (credential, input) => {
    if (!input.discussionId && !input.pageId) {
      throw new Error('Give either a pageId to start a thread or a discussionId to reply.');
    }
    const token = notionToken(credential);
    const target = input.discussionId
      ? { discussion_id: String(input.discussionId) }
      : { parent: { page_id: notionId(input.pageId) } };
    const comment = await notionRequest(token, 'POST', 'comments', {
      ...target,
      markdown: String(input.text),
    });
    // A token without the read comments capability gets back the id alone, so the
    // thread it just started cannot be replied to in the same run.
    return { id: String(comment.id ?? ''), discussionId: comment.discussion_id ?? null };
  },
};
