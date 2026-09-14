import { getZernio } from './client';
import { presentPostTimeline, presentSocialDashboard } from './presenters';

const RANGE_DAYS = 30;

export async function getSocialDashboard() {
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - RANGE_DAYS + 1);
  const dates = {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
  };

  const [accounts, analytics, scheduled, daily, bestTime] = await Promise.all([
    getZernio('/accounts', { platform: 'instagram' }),
    getZernio('/analytics', {
      platform: 'instagram',
      source: 'all',
      limit: '100',
      ...dates,
    }),
    getZernio('/posts', { platform: 'instagram', limit: '100' }),
    getZernio('/analytics/daily-metrics', {
      platform: 'instagram',
      source: 'all',
      attribution: 'publish',
      ...dates,
    }),
    getZernio('/analytics/best-time', { platform: 'instagram', source: 'all' }),
  ]);

  const dashboard = presentSocialDashboard(
    accounts,
    analytics,
    scheduled,
    daily,
    bestTime,
    RANGE_DAYS,
  );
  const featuredPost = dashboard.posts
    .filter((post) => post.status === 'published')
    .sort((a, b) => b.metrics.views + b.metrics.reach - (a.metrics.views + a.metrics.reach))[0];
  let featuredTimeline: ReturnType<typeof presentPostTimeline> = [];
  if (featuredPost) {
    try {
      featuredTimeline = presentPostTimeline(
        await getZernio('/analytics/post-timeline', { postId: featuredPost.id, ...dates }),
      );
    } catch {
      featuredTimeline = [];
    }
  }

  return {
    ...dashboard,
    featuredPostId: featuredPost?.id ?? null,
    featuredTimeline,
  };
}
