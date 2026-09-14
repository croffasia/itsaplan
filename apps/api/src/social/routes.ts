import { Elysia, t } from 'elysia';
import { guards } from '../shared/guards';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { getSocialDashboard } from './store';

const MetricsResponse = t.Object({
  reach: t.Number(),
  impressions: t.Number(),
  views: t.Number(),
  likes: t.Number(),
  comments: t.Number(),
  shares: t.Number(),
  saves: t.Number(),
  engagementRate: t.Number(),
});

const DashboardResponse = t.Object({
  rangeDays: t.Number(),
  syncedAt: t.Nullable(t.String()),
  account: t.Nullable(
    t.Object({
      username: t.String(),
      displayName: t.String(),
      profilePicture: t.Nullable(t.String()),
      profileUrl: t.Nullable(t.String()),
      followers: t.Number(),
      connected: t.Boolean(),
      needsReconnection: t.Boolean(),
    }),
  ),
  summary: t.Object({
    reach: t.Number(),
    impressions: t.Number(),
    views: t.Number(),
    engagements: t.Number(),
    engagementRate: t.Number(),
    followers: t.Number(),
    publishedPosts: t.Number(),
    scheduledPosts: t.Number(),
  }),
  daily: t.Array(
    t.Object({
      date: t.String(),
      reach: t.Number(),
      impressions: t.Number(),
      views: t.Number(),
      engagements: t.Number(),
    }),
  ),
  posts: t.Array(
    t.Object({
      id: t.String(),
      content: t.String(),
      status: t.String(),
      publishedAt: t.Nullable(t.String()),
      scheduledFor: t.Nullable(t.String()),
      mediaType: t.Nullable(t.String()),
      platformPostUrl: t.Nullable(t.String()),
      metrics: MetricsResponse,
    }),
  ),
  hashtags: t.Array(t.Object({ tag: t.String(), count: t.Number() })),
  bestTimes: t.Array(
    t.Object({
      day: t.Number(),
      hour: t.Number(),
      averageEngagement: t.Number(),
      postCount: t.Number(),
    }),
  ),
  featuredPostId: t.Nullable(t.String()),
  featuredTimeline: t.Array(t.Object({ date: t.String(), views: t.Number(), reach: t.Number() })),
});

function assertSocialProject(projectKey: string): void {
  const allowedProjectKey = process.env.ZERNIO_PROJECT_KEY;
  if (!allowedProjectKey) throw new HttpError(503, 'Social project is not configured');
  if (projectKey.toLowerCase() !== allowedProjectKey.toLowerCase()) {
    throw new HttpError(404, 'Social is not available for this project');
  }
}

export const socialRoutes = new Elysia({ name: 'social', detail: { tags: ['Social'] } })
  .use(guards)
  .get(
    '/projects/:projectKey/social/dashboard',
    ({ project }) => {
      assertSocialProject(project.key);
      return getSocialDashboard();
    },
    {
      permission: ['social', 'read'],
      response: {
        200: DashboardResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: "Get the project's read-only Instagram dashboard" },
    },
  );
