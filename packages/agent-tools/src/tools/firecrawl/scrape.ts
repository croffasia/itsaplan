import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { firecrawlPost } from './client';

// Scrapes a single web page to markdown through the Firecrawl API. Handles pages that
// need JavaScript rendering.
export const firecrawlScrape: CustomToolEntry = {
  key: 'firecrawl_scrape',
  label: 'Firecrawl Scrape',
  description:
    'Scrape a single web page and return its content as markdown (via the Firecrawl API). Use for pages that need JavaScript rendering.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the page to scrape.'),
    onlyMainContent: z
      .boolean()
      .default(true)
      .describe('Return only the main content, dropping navigation, headers, and footers.'),
  }),
  execute: async (credential, input) => {
    const data = (await firecrawlPost(
      String(credential.apiKey),
      'scrape',
      {
        url: String(input.url),
        formats: ['markdown'],
        onlyMainContent: input.onlyMainContent !== false,
      },
      'Firecrawl scrape',
    )) as { data?: { markdown?: string; metadata?: { title?: string } } };
    return {
      markdown: data.data?.markdown ?? '',
      title: data.data?.metadata?.title ?? null,
    };
  },
};
