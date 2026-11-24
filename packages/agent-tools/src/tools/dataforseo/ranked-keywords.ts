import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { dataforseoPost, keywordMetrics, market, marketInput, type KeywordData } from './client';

export const dataforseoRankedKeywords: CustomToolEntry = {
  key: 'dataforseo_ranked_keywords',
  label: 'DataForSEO Ranked Keywords',
  description:
    'List the Google keywords a domain or a page ranks for (via DataForSEO), highest search volume first. For each keyword: its metrics, rank, ranking URL and the estimated monthly traffic it brings. Also returns totals for the target: ranking keywords by position and estimated traffic.',
  inputSchema: z.object({
    target: z
      .string()
      .min(1)
      .describe(
        'A domain without https:// and www., e.g. example.com, or a full page URL with https://.',
      ),
    ...marketInput,
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('How many keywords to return. Default: 50. Each keyword adds to the price.'),
  }),
  execute: async (credential, input) => {
    const result = await dataforseoPost<{
      total_count?: number;
      metrics?: unknown;
      items?: {
        keyword_data?: KeywordData;
        ranked_serp_element?: {
          serp_item?: { type?: string; rank_group?: number; url?: string; etv?: number };
        };
      }[];
    }>(
      credential,
      'dataforseo_labs/google/ranked_keywords/live',
      {
        target: String(input.target),
        ...market(input),
        limit: Number(input.limit ?? 50),
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      },
      'DataForSEO ranked keywords',
    );
    return {
      totalCount: result?.total_count,
      metrics: result?.metrics,
      keywords: (result?.items ?? []).map((item) => {
        const serp = item.ranked_serp_element?.serp_item;
        return {
          ...keywordMetrics(item.keyword_data),
          rank: serp?.rank_group,
          resultType: serp?.type,
          url: serp?.url,
          traffic: serp?.etv,
        };
      }),
    };
  },
};
