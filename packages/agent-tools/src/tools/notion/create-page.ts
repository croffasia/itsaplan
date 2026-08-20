import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { notionId, notionRequest, notionToken } from './client';
import { titleProperty } from './page';

export const notionCreatePage: CustomToolEntry = {
  key: 'notion_create_page',
  label: 'Notion Create Page',
  scopes: ['Insert content'],
  description:
    'Create a Notion page under an existing page. The parent page must be shared with the connection. The body is written as markdown: headings, lists, checkboxes, quotes, code blocks, tables, callouts, links and inline formatting.',
  inputSchema: z.object({
    parentPageId: z
      .string()
      .min(1)
      .describe('Id or URL of the page the new page is created under.'),
    title: z.string().min(1).describe('Title of the new page.'),
    markdown: z.string().optional().describe('Page body as markdown.'),
  }),
  execute: async (credential, input) => {
    const token = notionToken(credential);
    const page = await notionRequest(token, 'POST', 'pages', {
      parent: { page_id: notionId(input.parentPageId, 'parent page') },
      properties: titleProperty(String(input.title)),
      ...(input.markdown ? { markdown: String(input.markdown) } : {}),
    });
    return { id: String(page.id ?? ''), url: page.url ?? null, title: String(input.title) };
  },
};
