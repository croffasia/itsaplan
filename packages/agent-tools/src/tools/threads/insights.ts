import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest } from './client';
import { timeFilter, toUnixSeconds } from '../time';

// One metric object in an insights response. The API uses two shapes per metric:
// { total_value: { value } } and { values: [{ value }] }.
interface InsightMetric {
  name?: string;
  total_value?: { value?: number };
  values?: Array<{ value?: number }>;
}

// Reads a metric value out of an insights response, handling both shapes.
function metricsMap(data: InsightMetric[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of data) {
    if (!m?.name) continue;
    const v = m.total_value?.value ?? m.values?.[0]?.value;
    out[m.name] = typeof v === 'number' ? v : Number(v) || 0;
  }
  return out;
}

const MEDIA_METRICS = 'views,likes,replies,reposts,quotes,shares';

// Lifetime insights for one of the token owner's posts. Requires the token to carry
// the threads_manage_insights scope.
export const threadsMediaInsights: CustomToolEntry = {
  key: 'threads_media_insights',
  label: 'Threads Post Insights',
  scopes: ['threads_basic', 'threads_manage_insights'],
  description:
    'Get lifetime insights (views, likes, replies, reposts, quotes, shares) for one of your Threads posts, by its media id. Requires the threads_manage_insights permission.',
  inputSchema: z.object({
    mediaId: z.string().min(1).describe('Media id of the post.'),
    metric: z.string().optional().describe(`Comma-separated metrics. Default: ${MEDIA_METRICS}.`),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', `${String(input.mediaId)}/insights`, {
      metric: (input.metric as string) || MEDIA_METRICS,
      access_token: token,
    });
    const data: InsightMetric[] = Array.isArray(body.data) ? body.data : [];
    return { metrics: metricsMap(data), raw: data };
  },
};

const USER_METRICS = 'views,likes,replies,reposts,quotes,followers_count';

// Account-level insights for the token owner. Requires the threads_manage_insights
// scope. The follower_demographics metric additionally requires a breakdown and at
// least 100 followers.
export const threadsUserInsights: CustomToolEntry = {
  key: 'threads_user_insights',
  label: 'Threads Account Insights',
  scopes: ['threads_basic', 'threads_manage_insights'],
  description:
    'Get account-level Threads insights (views, likes, replies, reposts, quotes, clicks, followers_count, follower_demographics). Requires the threads_manage_insights permission.',
  inputSchema: z.object({
    metric: z
      .string()
      .optional()
      .describe(
        `Comma-separated metrics. Default: ${USER_METRICS}. Others: clicks, follower_demographics.`,
      ),
    since: timeFilter
      .optional()
      .describe(
        'Range start. A unix timestamp in seconds or a date string (e.g. "2026-06-14"). Earliest allowed 2024-04-13.',
      ),
    until: timeFilter
      .optional()
      .describe(
        'Range end. A unix timestamp in seconds or a date string (e.g. "2026-07-14"). Earliest allowed 2024-04-13.',
      ),
    breakdown: z
      .enum(['country', 'city', 'age', 'gender'])
      .optional()
      .describe('Required only when requesting follower_demographics.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', 'me/threads_insights', {
      metric: (input.metric as string) || USER_METRICS,
      since: toUnixSeconds(input.since as number | string | undefined),
      until: toUnixSeconds(input.until as number | string | undefined),
      breakdown: input.breakdown as string | undefined,
      access_token: token,
    });
    const data: InsightMetric[] = Array.isArray(body.data) ? body.data : [];
    return { metrics: metricsMap(data), raw: data };
  },
};
