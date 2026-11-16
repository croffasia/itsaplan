import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { dataforseoPost, keywordMetrics, market, marketInput, type KeywordData } from './client';

export const dataforseoKeywordIdeas: CustomToolEntry = {
  key: 'dataforseo_keyword_ideas',
  label: 'DataForSEO Keyword Ideas',
  description:
    'Find new keywords related to the given ones (via DataForSEO). For each idea: monthly search volume, cost per click, ad competition, ranking difficulty from 0 to 100 and search intent. Use it to plan content or choose keywords to target.',
  inputSchema: z.object({
    keywords: z
      .array(z.string().min(1).max(80))
      .min(1)
      .max(200)
      .describe('Up to 200 keywords to find ideas for.'),
    ...marketInput,
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('How many ideas to return. Default: 50. Each idea adds to the price.'),
  }),
  execute: async (credential, input) => {
    const result = await dataforseoPost<{ total_count?: number; items?: KeywordData[] }>(
      credential,
      'dataforseo_labs/google/keyword_ideas/live',
      { keywords: input.keywords, ...market(input), limit: Number(input.limit ?? 50) },
      'DataForSEO keyword ideas',
    );
    return {
      totalCount: result?.total_count,
      keywords: (result?.items ?? []).map(keywordMetrics),
    };
  },
};
