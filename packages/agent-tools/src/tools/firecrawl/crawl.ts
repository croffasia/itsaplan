import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { firecrawlPost, pollJob } from './client';

// Crawls a whole website through the Firecrawl API: follows links from a starting URL
// and scrapes each page to markdown. The crawl is a Firecrawl job — this tool submits
// it and polls until it finishes or maxWaitSeconds elapses, returning the pages
// gathered so far. A still-running crawl comes back with status "processing" and its
// jobId (results stay available on Firecrawl for 24 hours).
export const firecrawlCrawl: CustomToolEntry = {
  key: 'firecrawl_crawl',
  label: 'Firecrawl Crawl',
  description:
    'Crawl a website (via the Firecrawl API): follow links from a starting URL and scrape each page to markdown. Returns the pages found. Use for whole-site content, not a single page (use scrape for that).',
  inputSchema: z.object({
    url: z.string().url().describe('The starting URL to crawl.'),
    limit: z.number().int().positive().max(1000).default(50).describe('Max pages to crawl.'),
    maxWaitSeconds: z
      .number()
      .int()
      .positive()
      .max(300)
      .default(60)
      .describe('How long to wait for the crawl before returning what is ready.'),
  }),
  execute: async (credential, input) => {
    const apiKey = String(credential.apiKey);
    const started = (await firecrawlPost(
      apiKey,
      'crawl',
      {
        url: String(input.url),
        limit: Number(input.limit ?? 50),
        scrapeOptions: { formats: ['markdown'] },
      },
      'Firecrawl crawl',
    )) as { id?: string };
    if (!started.id) throw new Error('Firecrawl crawl did not return a job id');

    const job = await pollJob(`crawl/${started.id}`, apiKey, 'Firecrawl crawl status', {
      maxWaitMs: Number(input.maxWaitSeconds ?? 60) * 1000,
    });
    const pages = (
      (job.data as Array<{ markdown?: string; metadata?: { url?: string } }>) ?? []
    ).map((p) => ({ url: p.metadata?.url ?? '', markdown: p.markdown ?? '' }));
    return {
      status: job.status ?? 'processing',
      jobId: started.id,
      total: job.total ?? null,
      completed: job.completed ?? null,
      // True when the crawl is still running or paginated past this batch; poll again
      // with the jobId or raise maxWaitSeconds to get the rest.
      truncated: job.status !== 'completed' || Boolean(job.next),
      pages,
    };
  },
};
