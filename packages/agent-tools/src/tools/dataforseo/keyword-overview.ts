import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { dataforseoPost, keywordMetrics, market, marketInput, type KeywordData } from './client';

export const dataforseoKeywordOverview: CustomToolEntry = {
  key: 'dataforseo_keyword_overview',
  label: 'DataForSEO Keyword Overview',
  description:
    'Get Google metrics for a list of keywords (via DataForSEO). For each keyword: monthly search volume, cost per click, ad competition, ranking difficulty from 0 to 100, search intent, and the search volume of each of the last 12 months. Keywords DataForSEO has no data for are left out.',
  inputSchema: z.object({
    keywords: z
      .array(z.string().min(1).max(80))
      .min(1)
      .max(700)
      .describe('Up to 700 keywords, each up to 80 characters and 10 words.'),
    ...marketInput,
  }),
  execute: async (credential, input) => {
    const result = await dataforseoPost<{ items?: KeywordData[] }>(
      credential,
      'dataforseo_labs/google/keyword_overview/live',
      { keywords: input.keywords, ...market(input) },
      'DataForSEO keyword overview',
    );
    return {
      keywords: (result?.items ?? []).map((item) => ({
        ...keywordMetrics(item),
        monthlySearches: item.keyword_info?.monthly_searches ?? [],
      })),
    };
  },
};
