import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest } from './client';
import { timeFilter, toUnixSeconds } from '../time';

// Reads account-level insights. Metric names, periods, and breakdowns are passed
// through verbatim because the supported set changes between API versions; the
// caller specifies the metrics it wants (e.g. reach, follower_count,
// profile_views, accounts_engaged).
export const instagramAccountInsights: CustomToolEntry = {
  key: 'instagram_account_insights',
  scopes: ['instagram_basic', 'instagram_manage_insights'],
  label: 'Instagram Account Insights',
  description:
    'Read account-level insights for the connected account. Specify metrics (comma-separated, e.g. reach, follower_count, profile_views, accounts_engaged) and, when the metric requires it, metric_type/period/breakdown/timeframe.',
  inputSchema: z.object({
    metric: z.string().describe('Comma-separated metric names to fetch.'),
    period: z
      .string()
      .optional()
      .describe('Aggregation period, e.g. day. Some metrics require it; others reject it.'),
    metricType: z
      .string()
      .optional()
      .describe('metric_type value, e.g. total_value, for metrics that support it.'),
    breakdown: z
      .string()
      .optional()
      .describe('Comma-separated breakdown dimensions, e.g. follow_type, media_product_type.'),
    timeframe: z
      .string()
      .optional()
      .describe('timeframe value for demographic metrics, e.g. last_30_days.'),
    since: timeFilter
      .optional()
      .describe('Range start. A unix timestamp in seconds or a date string (e.g. "2026-06-14").'),
    until: timeFilter
      .optional()
      .describe('Range end. A unix timestamp in seconds or a date string (e.g. "2026-07-14").'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'GET', `${igUserId}/insights`, {
      metric: String(input.metric),
      period: input.period,
      metric_type: input.metricType,
      breakdown: input.breakdown,
      timeframe: input.timeframe,
      since: toUnixSeconds(input.since as number | string | undefined),
      until: toUnixSeconds(input.until as number | string | undefined),
    });
  },
};

// Reads insights for a single media object.
export const instagramMediaInsights: CustomToolEntry = {
  key: 'instagram_media_insights',
  scopes: ['instagram_basic', 'instagram_manage_insights'],
  label: 'Instagram Media Insights',
  description:
    'Read insights for a single media object. Specify metrics (comma-separated, e.g. reach, likes, comments, saved, shares, total_interactions, views); supported metrics depend on the media type.',
  inputSchema: z.object({
    mediaId: z.string().describe('The IG media id (must be owned by the connected account).'),
    metric: z.string().describe('Comma-separated metric names to fetch.'),
    breakdown: z
      .string()
      .optional()
      .describe('Comma-separated breakdown dimensions, for metrics that support it.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'GET', `${String(input.mediaId)}/insights`, {
      metric: String(input.metric),
      breakdown: input.breakdown,
    });
  },
};
