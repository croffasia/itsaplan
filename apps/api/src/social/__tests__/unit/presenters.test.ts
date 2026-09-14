import { describe, expect, it } from 'bun:test';
import { presentPostTimeline, presentSocialDashboard } from '../../presenters';

describe('Social presenters', () => {
  it('returns only dashboard fields and derives totals', () => {
    const result = presentSocialDashboard(
      {
        accounts: [
          {
            _id: 'account-1',
            username: 'vexol',
            displayName: 'Vexol',
            profilePicture: 'https://cdn.example/avatar.jpg',
            profileUrl: 'https://instagram.com/vexol',
            followersCount: 120,
            isActive: true,
            needsReconnection: false,
            secret: 'must-not-leak',
          },
        ],
      },
      {
        overview: { lastSync: '2026-08-19T10:00:00.000Z' },
        posts: [
          {
            _id: 'post-1',
            content: 'A launch #Vexol #Launch',
            status: 'published',
            analytics: { reach: 100, impressions: 140, likes: 8, comments: 2 },
            userId: { email: 'private@example.com' },
          },
        ],
      },
      { posts: [] },
      {
        dailyData: [{ date: '2026-08-19', metrics: { reach: 100, likes: 8, comments: 2 } }],
      },
      { slots: [{ day_of_week: 2, hour: 18, avg_engagement: 42, post_count: 3 }] },
      30,
    );

    expect(result.summary).toMatchObject({ reach: 100, impressions: 140, engagements: 10 });
    expect(result.hashtags).toEqual([
      { tag: '#launch', count: 1 },
      { tag: '#vexol', count: 1 },
    ]);
    expect(result.bestTimes[0]).toEqual({
      day: 2,
      hour: 18,
      averageEngagement: 42,
      postCount: 3,
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(JSON.stringify(result)).not.toContain('private@example.com');
  });

  it('rejects non-http media URLs and includes scheduled posts once', () => {
    const result = presentSocialDashboard(
      { accounts: [] },
      { posts: [] },
      {
        posts: [
          {
            _id: 'scheduled-1',
            content: 'Coming soon',
            status: 'scheduled',
            mediaItems: [{ url: 'javascript:alert(1)' }],
          },
        ],
      },
      { dailyData: [] },
      { slots: [] },
      30,
    );

    expect(result.summary.scheduledPosts).toBe(1);
    expect(result.posts[0]).not.toHaveProperty('thumbnailUrl');
  });

  it('presents only chart fields from a post timeline', () => {
    expect(
      presentPostTimeline({
        timeline: [
          {
            date: '2026-08-19',
            views: 20,
            reach: 15,
            platformPostId: 'private-platform-id',
          },
        ],
      }),
    ).toEqual([{ date: '2026-08-19', views: 20, reach: 15 }]);
  });
});
