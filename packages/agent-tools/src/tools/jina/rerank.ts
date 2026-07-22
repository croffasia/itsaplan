import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';
import { jinaAuth } from './auth';

// Reranks candidate documents by relevance to a query (Jina Reranker).
export const jinaRerank: CustomToolEntry = {
  key: 'jina_rerank',
  label: 'Jina Rerank',
  description:
    'Rerank a list of documents by relevance to a query. Returns the documents ordered by score. Use to pick the most relevant items from a candidate list.',
  inputSchema: z.object({
    query: z.string().min(1).describe('The query to rank documents against.'),
    documents: z.array(z.string()).min(1).describe('The candidate documents to rank.'),
    topN: z.number().int().min(1).optional().describe('Return only the top N documents.'),
  }),
  execute: async (credential, input) => {
    const documents = (input.documents as string[]).map(String);
    const res = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...jinaAuth(credential) },
      body: JSON.stringify({
        model: 'jina-reranker-v2-base-multilingual',
        query: String(input.query),
        documents,
        top_n: input.topN != null ? Number(input.topN) : undefined,
        return_documents: true,
      }),
    });
    const body = (await jsonOrThrow(res, 'Jina Rerank')) as {
      results?: { index: number; relevance_score: number; document?: { text?: string } }[];
    };
    const results = (body.results ?? []).map((r) => ({
      index: r.index,
      score: r.relevance_score,
      document: r.document?.text ?? documents[r.index] ?? '',
    }));
    return { results };
  },
};
