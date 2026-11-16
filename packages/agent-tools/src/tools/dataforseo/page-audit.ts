import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { dataforseoPost } from './client';

export const dataforseoPageAudit: CustomToolEntry = {
  key: 'dataforseo_page_audit',
  label: 'DataForSEO Page Audit',
  description:
    'Check one web page for on-page SEO (via DataForSEO). Returns the HTTP status, a score from 0 to 100, title, meta description, canonical URL, H1 headings, word count, link and image counts, and load time and Largest Contentful Paint in milliseconds. Also lists the checks that are true for the page, such as no_h1_tag, title_too_long or is_https.',
  inputSchema: z.object({
    url: z.string().url().describe('The full URL of the page.'),
    render: z
      .boolean()
      .optional()
      .describe(
        'Render the page in a browser before the check: runs its scripts and measures Largest Contentful Paint. Costs more.',
      ),
  }),
  execute: async (credential, input) => {
    const result = await dataforseoPost<{
      items?: {
        url?: string;
        status_code?: number;
        onpage_score?: number;
        meta?: {
          title?: string;
          description?: string;
          canonical?: string;
          htags?: { h1?: string[] };
          content?: { plain_text_word_count?: number };
          internal_links_count?: number;
          external_links_count?: number;
          images_count?: number;
        };
        page_timing?: { duration_time?: number; largest_contentful_paint?: number };
        checks?: Record<string, boolean>;
      }[];
    }>(
      credential,
      'on_page/instant_pages',
      { url: String(input.url), enable_browser_rendering: input.render },
      'DataForSEO page audit',
    );
    const page = result?.items?.[0];
    return {
      url: page?.url ?? String(input.url),
      statusCode: page?.status_code,
      score: page?.onpage_score,
      title: page?.meta?.title,
      description: page?.meta?.description,
      canonical: page?.meta?.canonical,
      h1: page?.meta?.htags?.h1 ?? [],
      wordCount: page?.meta?.content?.plain_text_word_count,
      internalLinks: page?.meta?.internal_links_count,
      externalLinks: page?.meta?.external_links_count,
      images: page?.meta?.images_count,
      loadTime: page?.page_timing?.duration_time,
      largestContentfulPaint: page?.page_timing?.largest_contentful_paint,
      checks: Object.entries(page?.checks ?? {})
        .filter(([, on]) => on)
        .map(([name]) => name),
    };
  },
};
