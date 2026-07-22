import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';
import { jinaAuth } from './auth';

// Per-result content is capped so a multi-result search does not flood the model's
// context with full page dumps.
const MAX_CONTENT = 4000;

// Web search that returns the top results already crawled to markdown (s.jina.ai).
export const jinaSearch: CustomToolEntry = {
  key: 'jina_search',
  label: 'Jina Search',
  description:
    "Search the web and return the top results with each page's content as markdown. Use to find current information across the web.",
  inputSchema: z.object({
    query: z.string().min(1).describe('The search query.'),
    count: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe('How many results to return (default 5).'),
  }),
  execute: async (credential, input) => {
    const res = await fetch('https://s.jina.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...jinaAuth(credential),
      },
      body: JSON.stringify({ q: String(input.query), count: Number(input.count ?? 5) }),
    });
    const body = (await jsonOrThrow(res, 'Jina Search')) as {
      data?: { title?: string; url?: string; description?: string; content?: string }[];
    };
    const results = (body.data ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      description: r.description ?? '',
      content: (r.content ?? '').slice(0, MAX_CONTENT),
    }));
    return { results };
  },
};
