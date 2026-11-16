import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { dataforseoPost } from './client';

export const dataforseoBacklinks: CustomToolEntry = {
  key: 'dataforseo_backlinks',
  label: 'DataForSEO Backlinks',
  description:
    'Get the backlink profile of a domain or a page (via DataForSEO). Returns its rank, live backlinks, referring domains and pages, broken backlinks, its spam score, the average spam score of its backlinks, and the date it was first seen. Rank and spam scores run from 0 to 100. Needs access to the Backlinks API in the DataForSEO account.',
  inputSchema: z.object({
    target: z
      .string()
      .min(1)
      .describe(
        'A domain without https:// and www., e.g. example.com, or a full page URL with https://.',
      ),
  }),
  execute: async (credential, input) => {
    const result = await dataforseoPost<{
      rank?: number;
      backlinks?: number;
      referring_domains?: number;
      referring_main_domains?: number;
      referring_pages?: number;
      broken_backlinks?: number;
      backlinks_spam_score?: number;
      info?: { target_spam_score?: number };
      first_seen?: string;
    }>(
      credential,
      'backlinks/summary/live',
      { target: String(input.target), rank_scale: 'one_hundred' },
      'DataForSEO backlinks',
    );
    return {
      rank: result?.rank,
      backlinks: result?.backlinks,
      referringDomains: result?.referring_domains,
      referringMainDomains: result?.referring_main_domains,
      referringPages: result?.referring_pages,
      brokenBacklinks: result?.broken_backlinks,
      spamScore: result?.info?.target_spam_score,
      backlinksSpamScore: result?.backlinks_spam_score,
      firstSeen: result?.first_seen,
    };
  },
};
