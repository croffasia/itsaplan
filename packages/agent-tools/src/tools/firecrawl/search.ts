import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { firecrawlPost } from './client';

// Searches the web through the Firecrawl API and returns the top results (title, URL,
// description). Optionally scrapes each result to markdown.
export const firecrawlSearch: CustomToolEntry = {
  key: 'firecrawl_search',
  label: 'Firecrawl Search',
  description:
    "Search the web (via the Firecrawl API) and return the top results with title, URL, and description. Set scrapeContent to also fetch each result's page as markdown.",
  inputSchema: z.object({
    query: z.string().min(1).describe('The search query.'),
    limit: z.number().int().positive().max(20).default(5).describe('Max results to return.'),
    scrapeContent: z
      .boolean()
      .default(false)
      .describe('Also scrape each result page to markdown (slower).'),
  }),
  execute: async (credential, input) => {
    const scrape = input.scrapeContent === true;
    const data = (await firecrawlPost(
      String(credential.apiKey),
      'search',
      {
        query: String(input.query),
        limit: Number(input.limit ?? 5),
        ...(scrape ? { scrapeOptions: { formats: ['markdown'] } } : {}),
      },
      'Firecrawl search',
    )) as {
      data?: {
        web?: Array<{ url?: string; title?: string; description?: string; markdown?: string }>;
      };
    };
    const results = (data.data?.web ?? []).map((r) => ({
      url: r.url ?? '',
      title: r.title ?? '',
      description: r.description ?? '',
      ...(scrape ? { markdown: r.markdown ?? '' } : {}),
    }));
    return { results };
  },
};
