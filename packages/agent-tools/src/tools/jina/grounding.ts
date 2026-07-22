import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';
import { jinaAuth } from './auth';

// Fact-checks a statement against real-time web sources (g.jina.ai).
export const jinaGrounding: CustomToolEntry = {
  key: 'jina_grounding',
  label: 'Jina Grounding',
  description:
    'Fact-check a statement against real-time web sources. Returns a factuality score (0-1), a true/false verdict, the reasoning, and reference URLs.',
  inputSchema: z.object({
    statement: z.string().min(1).describe('The factual statement to verify.'),
  }),
  execute: async (credential, input) => {
    const res = await fetch('https://g.jina.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...jinaAuth(credential),
      },
      body: JSON.stringify({ statement: String(input.statement) }),
    });
    const body = (await jsonOrThrow(res, 'Jina Grounding')) as {
      data?: {
        factuality?: number;
        result?: boolean;
        reason?: string;
        references?: { url?: string; keyQuote?: string; isSupportive?: boolean }[];
      };
    };
    return {
      factuality: body.data?.factuality ?? null,
      result: body.data?.result ?? null,
      reason: body.data?.reason ?? '',
      references: body.data?.references ?? [],
    };
  },
};
