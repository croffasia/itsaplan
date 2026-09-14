import { describe, expect, it } from 'bun:test';
import type { SocialPost } from '@/lib/api';
import { filterSocialPosts, postTitle } from './social';

const post: SocialPost = {
  id: 'one',
  content: 'Product launch\nMore copy',
  status: 'published',
  publishedAt: null,
  scheduledFor: null,
  mediaType: null,
  platformPostUrl: null,
  metrics: {
    reach: 0,
    impressions: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagementRate: 0,
  },
};

describe('Social dashboard utilities', () => {
  it('uses the first caption line as the post title', () => {
    expect(postTitle(post)).toBe('Product launch');
  });

  it('filters posts by status and caption', () => {
    expect(filterSocialPosts([post], 'published', 'launch')).toEqual([post]);
    expect(filterSocialPosts([post], 'scheduled', '')).toEqual([]);
  });
});
