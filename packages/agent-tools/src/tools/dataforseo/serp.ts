import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { dataforseoPost, market, marketInput } from './client';

export const dataforseoSerp: CustomToolEntry = {
  key: 'dataforseo_serp',
  label: 'DataForSEO Search Results',
  description:
    'Get the live Google results for a keyword (via DataForSEO). Returns the organic results with rank, title, URL and description, the total number of results, and the special result blocks on the page, such as people_also_ask or local_pack. Use it to see who ranks for a keyword and where a site stands.',
  inputSchema: z.object({
    keyword: z.string().min(1).max(700).describe('The keyword to search for.'),
    ...marketInput,
    location: marketInput.location.describe(
      'A country by full name, e.g. "United Kingdom", or a city with its region and country, e.g. "London,England,United Kingdom". Default: United States.',
    ),
    device: z.enum(['desktop', 'mobile']).optional().describe('Default: desktop.'),
    depth: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many results to read. Default: 10. Every 10 results are billed as one page.'),
  }),
  execute: async (credential, input) => {
    const result = await dataforseoPost<{
      se_results_count?: number;
      item_types?: string[];
      items?: {
        type?: string;
        rank_group?: number;
        title?: string;
        url?: string;
        domain?: string;
        description?: string;
      }[];
    }>(
      credential,
      'serp/google/organic/live/advanced',
      {
        keyword: String(input.keyword),
        ...market(input),
        device: input.device,
        depth: input.depth,
      },
      'DataForSEO search results',
    );
    return {
      totalResults: result?.se_results_count,
      features: result?.item_types ?? [],
      results: (result?.items ?? [])
        .filter((i) => i.type === 'organic')
        .map((i) => ({
          rank: i.rank_group,
          title: i.title,
          url: i.url,
          domain: i.domain,
          description: i.description,
        })),
    };
  },
};
