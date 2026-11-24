import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { dataforseoPost, market, marketInput } from './client';

export const dataforseoCompetitors: CustomToolEntry = {
  key: 'dataforseo_competitors',
  label: 'DataForSEO Competitors',
  description:
    'Find the domains that compete with a domain in Google search (via DataForSEO), the most shared organic keywords first. For each competitor: the number of shared keywords, its average position on them, its total ranking keywords and its estimated monthly traffic. The target itself can appear first in the list.',
  inputSchema: z.object({
    target: z.string().min(1).describe('A domain without https:// and www., e.g. example.com.'),
    ...marketInput,
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many competitors to return. Default: 10.'),
  }),
  execute: async (credential, input) => {
    const result = await dataforseoPost<{
      items?: {
        domain?: string;
        avg_position?: number;
        intersections?: number;
        full_domain_metrics?: { organic?: { count?: number; etv?: number } };
      }[];
    }>(
      credential,
      'dataforseo_labs/google/competitors_domain/live',
      {
        target: String(input.target),
        ...market(input),
        limit: Number(input.limit ?? 10),
      },
      'DataForSEO competitors',
    );
    return {
      competitors: (result?.items ?? []).map((item) => ({
        domain: item.domain,
        sharedKeywords: item.intersections,
        averagePosition: item.avg_position,
        keywords: item.full_domain_metrics?.organic?.count,
        traffic: item.full_domain_metrics?.organic?.etv,
      })),
    };
  },
};
