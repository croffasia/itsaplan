import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { firecrawlPost } from './client';

// Maps a website: returns the URLs Firecrawl can find on a domain, optionally filtered
// by a text match. Use to discover pages before scraping or crawling.
export const firecrawlMap: CustomToolEntry = {
  key: 'firecrawl_map',
  label: 'Firecrawl Map',
  description:
    'Discover the URLs on a website (via the Firecrawl API). Returns a list of links, optionally filtered by a search term. Use to find pages before scraping.',
  inputSchema: z.object({
    url: z.string().url().describe('The website URL to map.'),
    search: z.string().optional().describe('Only return links whose text matches this term.'),
    limit: z.number().int().positive().max(5000).default(100).describe('Max links to return.'),
    includeSubdomains: z
      .boolean()
      .default(true)
      .describe('Include links on subdomains of the site.'),
  }),
  execute: async (credential, input) => {
    const data = (await firecrawlPost(
      String(credential.apiKey),
      'map',
      {
        url: String(input.url),
        ...(input.search ? { search: String(input.search) } : {}),
        limit: Number(input.limit ?? 100),
        includeSubdomains: input.includeSubdomains !== false,
      },
      'Firecrawl map',
    )) as { links?: Array<string | { url?: string }> };
    const links = (data.links ?? []).map((l) => (typeof l === 'string' ? l : (l.url ?? '')));
    return { links: links.filter(Boolean) };
  },
};
