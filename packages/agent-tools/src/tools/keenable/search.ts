import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { keenableRequest } from './client';

// Per-result text is capped so a multi-result search does not flood the model's
// context with full page dumps.
const MAX_SNIPPET = 4000;

export const keenableSearch: CustomToolEntry = {
  key: 'keenable_search',
  label: 'Keenable Search',
  description:
    'Search the web (via the Keenable API) and return the top results with title, URL, and the matching text of each page. Use to find current information across the web.',
  inputSchema: z.object({
    query: z.string().min(1).describe('The search query.'),
    count: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe('How many results to return (default 5).'),
    site: z
      .string()
      .min(1)
      .optional()
      .describe('Limit the results to one domain, e.g. docs.example.com.'),
  }),
  execute: async (_credential, input) => {
    const body = (await keenableRequest(
      'search/public',
      {
        query: String(input.query),
        max_results: Number(input.count ?? 5),
        ...(input.site ? { site: String(input.site) } : {}),
      },
      'Keenable search',
    )) as { results?: { title?: string; url?: string; snippet?: string }[] };
    const results = (body.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: (r.snippet ?? '').slice(0, MAX_SNIPPET),
    }));
    return { results };
  },
};
