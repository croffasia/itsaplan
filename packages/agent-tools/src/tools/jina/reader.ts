import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';
import { jinaAuth } from './auth';

// Reads one web page and returns its main content as clean markdown (r.jina.ai).
export const jinaReader: CustomToolEntry = {
  key: 'jina_reader',
  label: 'Jina Reader',
  description:
    'Read a web page and return its main content as clean markdown. Use to fetch and read an article, documentation, or any single URL.',
  inputSchema: z.object({ url: z.string().url().describe('The URL of the page to read.') }),
  execute: async (credential, input) => {
    const res = await fetch('https://r.jina.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...jinaAuth(credential),
      },
      body: JSON.stringify({ url: String(input.url) }),
    });
    const body = (await jsonOrThrow(res, 'Jina Reader')) as {
      data?: { title?: string; url?: string; content?: string };
    };
    return {
      title: body.data?.title ?? '',
      url: body.data?.url ?? String(input.url),
      content: body.data?.content ?? '',
    };
  },
};
