import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { keenableRequest } from './client';

export const keenableFetch: CustomToolEntry = {
  key: 'keenable_fetch',
  label: 'Keenable Fetch',
  description:
    'Fetch a web page (via the Keenable API) and return its content as markdown. Use to read an article, documentation, or any single URL, such as a search result.',
  inputSchema: z.object({ url: z.string().url().describe('The URL of the page to fetch.') }),
  execute: async (_credential, input) => {
    const body = (await keenableRequest(
      `fetch/public?${new URLSearchParams({ url: String(input.url) })}`,
      null,
      'Keenable fetch',
    )) as { url?: string; title?: string; content?: string };
    return {
      title: body.title ?? '',
      url: body.url ?? String(input.url),
      content: body.content ?? '',
    };
  },
};
