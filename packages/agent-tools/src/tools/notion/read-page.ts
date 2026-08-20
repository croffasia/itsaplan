import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { notionId, notionRequest, notionToken } from './client';
import { pageProperties, pageTitle } from './page';

// Notion renders a page of up to ~20,000 blocks in one response, far past the ~25k
// tokens a model still reads and searches over reliably. The bound is in characters
// because there is no tokenizer here: Cyrillic markdown runs about 2.5 characters per
// token, so 60,000 stays inside the budget in the worst case and holds a much longer
// page in Latin script. `truncated` says the page went on — whether it was Notion or
// this cap that stopped it.
const MAX_CHARS = 60000;

// Cuts at the last line break before the bound, so the body does not end mid-line.
export function cut(markdown: string): string {
  if (markdown.length <= MAX_CHARS) return markdown;
  const head = markdown.slice(0, MAX_CHARS);
  const lastBreak = head.lastIndexOf('\n');
  return lastBreak > 0 ? head.slice(0, lastBreak) : head;
}

// Reads a page: its properties, and its body as the markdown Notion renders it from
// the whole block tree.
export const notionReadPage: CustomToolEntry = {
  key: 'notion_read_page',
  label: 'Notion Read Page',
  scopes: ['Read content'],
  description:
    'Read a Notion page: its properties and its full body as markdown, tables, callouts and sub-pages included. The exact text that comes back is what notion_update_page matches against when editing part of the page.',
  inputSchema: z.object({
    pageId: z.string().min(1).describe('The page id, or the page URL copied from Notion.'),
  }),
  execute: async (credential, input) => {
    const token = notionToken(credential);
    const id = notionId(input.pageId);
    const [page, body] = await Promise.all([
      notionRequest(token, 'GET', `pages/${id}`),
      notionRequest(token, 'GET', `pages/${id}/markdown`),
    ]);
    const markdown = String(body.markdown ?? '');
    const content = cut(markdown);
    return {
      id,
      url: page.url ?? null,
      title: pageTitle(page),
      properties: pageProperties(page),
      lastEditedTime: page.last_edited_time ?? null,
      content,
      truncated: body.truncated === true || content.length < markdown.length,
    };
  },
};
