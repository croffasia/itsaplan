import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { firecrawlPost, pollJob } from './client';

// Extracts structured data from one or more URLs through the Firecrawl API: a prompt
// says what to pull out, an optional JSON schema fixes the shape of the result. The
// extraction is a Firecrawl job — this tool submits it and polls until it finishes or
// maxWaitSeconds elapses. A still-running job comes back with status "processing" and
// its jobId.
export const firecrawlExtract: CustomToolEntry = {
  key: 'firecrawl_extract',
  label: 'Firecrawl Extract',
  description:
    'Extract structured data from web pages (via the Firecrawl API). Give the URLs and a prompt describing what to pull out; pass a JSON schema to fix the output shape. Returns the extracted data.',
  inputSchema: z.object({
    urls: z
      .array(z.string().url())
      .min(1)
      .describe('The URLs to extract from. A URL may end in /* to include its subpages.'),
    prompt: z.string().min(1).describe('What to extract from the pages.'),
    schema: z
      .record(z.string(), z.any())
      .optional()
      .describe('Optional JSON schema for the output shape.'),
    enableWebSearch: z
      .boolean()
      .default(false)
      .describe('Let the extraction follow links beyond the given URLs for more context.'),
    maxWaitSeconds: z
      .number()
      .int()
      .positive()
      .max(300)
      .default(60)
      .describe('How long to wait for the extraction before returning its status.'),
  }),
  execute: async (credential, input) => {
    const apiKey = String(credential.apiKey);
    const started = (await firecrawlPost(
      apiKey,
      'extract',
      {
        urls: input.urls as string[],
        prompt: String(input.prompt),
        ...(input.schema ? { schema: input.schema } : {}),
        enableWebSearch: input.enableWebSearch === true,
      },
      'Firecrawl extract',
    )) as { id?: string };
    if (!started.id) throw new Error('Firecrawl extract did not return a job id');

    const job = await pollJob(`extract/${started.id}`, apiKey, 'Firecrawl extract status', {
      maxWaitMs: Number(input.maxWaitSeconds ?? 60) * 1000,
    });
    return {
      status: job.status ?? 'processing',
      jobId: started.id,
      data: job.data ?? null,
    };
  },
};
