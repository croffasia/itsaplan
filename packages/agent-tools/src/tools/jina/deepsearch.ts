import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';
import { jinaAuth } from './auth';

// Iterative research that searches, reads, and reasons over the web until it reaches
// a confident answer (OpenAI chat-completions compatible).
export const jinaDeepSearch: CustomToolEntry = {
  key: 'jina_deepsearch',
  label: 'Jina DeepSearch',
  description:
    'Answer a complex question by iteratively searching, reading, and reasoning across the web. Slower but thorough; use for research questions that need multiple sources.',
  inputSchema: z.object({
    question: z.string().min(1).describe('The research question to answer.'),
    reasoningEffort: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('How much reasoning to spend (default medium; higher is slower).'),
  }),
  execute: async (credential, input) => {
    const res = await fetch('https://deepsearch.jina.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...jinaAuth(credential) },
      body: JSON.stringify({
        model: 'jina-deepsearch-v1',
        stream: false,
        reasoning_effort: String(input.reasoningEffort ?? 'medium'),
        messages: [{ role: 'user', content: String(input.question) }],
      }),
    });
    const body = (await jsonOrThrow(res, 'Jina DeepSearch')) as {
      choices?: { message?: { content?: string } }[];
      visitedURLs?: string[];
    };
    return {
      answer: body.choices?.[0]?.message?.content ?? '',
      sources: body.visitedURLs ?? [],
    };
  },
};
