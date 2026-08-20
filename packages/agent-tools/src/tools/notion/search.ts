import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { notionRequest, notionToken } from './client';
import { pageTitle } from './page';

// Finds pages by title among those shared with the integration.
export const notionSearch: CustomToolEntry = {
  key: 'notion_search',
  label: 'Notion Search',
  scopes: ['Read content'],
  description:
    'Find Notion pages by name. Only pages shared with the connection are searchable. Returns each match with its page id, which the other Notion tools take. Omit the query to list every page the connection can see.',
  inputSchema: z.object({
    query: z.string().optional().describe('Text to match against page titles.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many pages to return (default 10).'),
  }),
  execute: async (credential, input) => {
    const body = await notionRequest(notionToken(credential), 'POST', 'search', {
      query: input.query ? String(input.query) : '',
      filter: { property: 'object', value: 'page' },
      page_size: Number(input.limit ?? 10),
    });
    const results = (body.results ?? []).map((page) => ({
      id: String(page.id ?? ''),
      title: pageTitle(page),
      url: page.url ?? null,
      lastEditedTime: page.last_edited_time ?? null,
    }));
    return { results };
  },
};
