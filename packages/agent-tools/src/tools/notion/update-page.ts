import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { notionId, notionRequest, notionToken } from './client';
import { titleProperty } from './page';

// The body of a PATCH /v1/pages/{id}/markdown call for each mode the tool offers.
// "append" uses insert_content, which Notion marks legacy but is the only command
// that adds to a page without sending its whole body back.
function command(mode: string, markdown: string, find: string): Record<string, unknown> {
  switch (mode) {
    case 'replace':
      return { type: 'replace_content', replace_content: { new_str: markdown } };
    case 'edit':
      return {
        type: 'update_content',
        update_content: { content_updates: [{ old_str: find, new_str: markdown }] },
      };
    default:
      return {
        type: 'insert_content',
        insert_content: { content: markdown, position: { type: 'end' } },
      };
  }
}

export const notionUpdatePage: CustomToolEntry = {
  key: 'notion_update_page',
  label: 'Notion Update Page',
  scopes: ['Update content', 'Insert content'],
  description:
    'Edit a Notion page. Mode "append" adds markdown to the end, "replace" rewrites the whole body, and "edit" swaps one passage for another: `find` is the existing text, copied exactly as notion_read_page returned it, and `markdown` is what replaces it. A title given without markdown only renames the page.',
  inputSchema: z.object({
    pageId: z.string().min(1).describe('The page id, or the page URL copied from Notion.'),
    mode: z
      .enum(['append', 'replace', 'edit'])
      .optional()
      .describe('How the markdown is applied (default "append").'),
    markdown: z.string().optional().describe('The new content as markdown.'),
    find: z
      .string()
      .optional()
      .describe('The exact existing text to replace. Required for mode "edit".'),
    title: z.string().optional().describe('New page title.'),
  }),
  execute: async (credential, input) => {
    const token = notionToken(credential);
    const pageId = notionId(input.pageId);
    const mode = String(input.mode ?? 'append');
    const markdown = input.markdown ? String(input.markdown) : '';

    if (input.title) {
      await notionRequest(token, 'PATCH', `pages/${pageId}`, {
        properties: titleProperty(String(input.title)),
      });
    }

    if (!markdown) {
      if (!input.title) throw new Error('Nothing to update: give markdown, a title, or both.');
      return { id: pageId, renamed: true };
    }

    const find = input.find ? String(input.find) : '';
    if (mode === 'edit' && !find) throw new Error('Mode "edit" needs the text to replace in find.');

    await notionRequest(token, 'PATCH', `pages/${pageId}/markdown`, command(mode, markdown, find));
    return { id: pageId, mode, updated: true };
  },
};
