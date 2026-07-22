import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';
import { jinaAuth } from './auth';

// Splits long text into semantic chunks and counts tokens (Jina Segmenter).
export const jinaSegment: CustomToolEntry = {
  key: 'jina_segment',
  label: 'Jina Segment',
  description:
    'Split long text into semantically coherent chunks and count its tokens. Use to chunk text before embedding or storage.',
  inputSchema: z.object({
    content: z.string().min(1).describe('The text to segment.'),
    maxChunkLength: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Maximum characters per chunk (default 1000).'),
  }),
  execute: async (credential, input) => {
    const res = await fetch('https://api.jina.ai/v1/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...jinaAuth(credential) },
      body: JSON.stringify({
        content: String(input.content),
        return_chunks: true,
        max_chunk_length: Number(input.maxChunkLength ?? 1000),
      }),
    });
    const body = (await jsonOrThrow(res, 'Jina Segment')) as {
      num_tokens?: number;
      chunks?: string[];
    };
    return { numTokens: body.num_tokens ?? null, chunks: body.chunks ?? [] };
  },
};
