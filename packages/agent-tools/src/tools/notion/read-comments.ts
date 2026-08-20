import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { notionId, notionRequest, notionToken } from './client';
import { fromRichText } from './page';

// Notion returns at most 100 comments in one request, oldest first; a longer thread is
// cut there rather than paged through, so one call stays small.
const MAX_COMMENTS = 100;

// Reads the open comments on a page itself; comments left on its blocks are separate
// threads and are not returned.
export const notionReadComments: CustomToolEntry = {
  key: 'notion_read_comments',
  label: 'Notion Read Comments',
  scopes: ['Read comments'],
  description:
    'Read the open comments on a Notion page. Each comment carries a discussionId, which notion_add_comment takes to reply in the same thread. Resolved comments are not returned.',
  inputSchema: z.object({
    pageId: z.string().min(1).describe('The page id, or the page URL copied from Notion.'),
  }),
  execute: async (credential, input) => {
    const pageId = notionId(input.pageId);
    const body = await notionRequest(
      notionToken(credential),
      'GET',
      `comments?block_id=${pageId}&page_size=${MAX_COMMENTS}`,
    );
    const comments = (body.results ?? []).map((comment) => ({
      id: String(comment.id ?? ''),
      discussionId: String(comment.discussion_id ?? ''),
      createdTime: comment.created_time ?? null,
      authorId: (comment.created_by as { id?: string } | undefined)?.id ?? null,
      text: fromRichText(comment.rich_text),
    }));
    return { comments };
  },
};
