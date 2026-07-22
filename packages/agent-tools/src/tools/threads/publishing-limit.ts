import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, threadsRequest } from './client';

const LIMIT_FIELDS =
  'quota_usage,config,reply_quota_usage,reply_config,' +
  'delete_quota_usage,delete_config,location_search_quota_usage,location_search_config';

// The token owner's current publishing quota usage (posts and replies).
export const threadsPublishingLimit: CustomToolEntry = {
  key: 'threads_publishing_limit',
  label: 'Threads Publishing Limit',
  scopes: ['threads_basic', 'threads_content_publish'],
  description:
    'Get your current Threads publishing quota usage and limits for posts and replies. Check before publishing to avoid hitting the rate limit.',
  inputSchema: z.object({}),
  execute: async (credential) => {
    const token = threadsToken(credential);
    const body = await threadsRequest('GET', 'me/threads_publishing_limit', {
      fields: LIMIT_FIELDS,
      access_token: token,
    });
    return Array.isArray(body.data) ? (body.data[0] ?? {}) : body;
  },
};
