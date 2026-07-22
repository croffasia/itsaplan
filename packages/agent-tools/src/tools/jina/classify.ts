import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';
import { jinaAuth } from './auth';

// Zero-shot text classification into caller-provided labels (Jina Classifier).
export const jinaClassify: CustomToolEntry = {
  key: 'jina_classify',
  label: 'Jina Classify',
  description:
    'Classify text into one of the given labels (zero-shot, no training). Provide the text and the candidate labels; returns the best-matching label and per-label scores.',
  inputSchema: z.object({
    text: z.string().min(1).describe('The text to classify.'),
    labels: z.array(z.string()).min(2).describe('The candidate labels to choose from.'),
  }),
  execute: async (credential, input) => {
    const res = await fetch('https://api.jina.ai/v1/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...jinaAuth(credential) },
      body: JSON.stringify({
        model: 'jina-embeddings-v3',
        input: [{ text: String(input.text) }],
        labels: (input.labels as string[]).map(String),
      }),
    });
    const body = (await jsonOrThrow(res, 'Jina Classify')) as {
      data?: {
        prediction?: string;
        score?: number;
        predictions?: { label: string; score: number }[];
      }[];
    };
    const first = body.data?.[0];
    return {
      label: first?.prediction ?? '',
      score: first?.score ?? null,
      scores: first?.predictions ?? [],
    };
  },
};
