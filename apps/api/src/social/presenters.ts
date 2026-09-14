type JsonObject = Record<string, unknown>;

export interface SocialPost {
  id: string;
  content: string;
  status: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  mediaType: string | null;
  platformPostUrl: string | null;
  metrics: SocialMetrics;
}

interface SocialMetrics {
  reach: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

const object = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const string = (value: unknown): string => (typeof value === 'string' ? value : '');
const nullableString = (value: unknown): string | null => {
  const result = string(value).trim();
  return result || null;
};
const number = (value: unknown): number => {
  const result = Number(value);
  return Number.isFinite(result) ? Math.max(0, result) : 0;
};
const boolean = (value: unknown): boolean => value === true;
const url = (value: unknown): string | null => {
  const result = nullableString(value);
  if (!result) return null;
  try {
    const parsed = new URL(result);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? result : null;
  } catch {
    return null;
  }
};

function metrics(value: unknown): SocialMetrics {
  const data = object(value);
  return {
    reach: number(data.reach),
    impressions: number(data.impressions),
    views: number(data.views),
    likes: number(data.likes),
    comments: number(data.comments),
    shares: number(data.shares),
    saves: number(data.saves),
    engagementRate: number(data.engagementRate),
  };
}

function analyticsPost(value: unknown): SocialPost | null {
  const post = object(value);
  const id =
    nullableString(post._id) ?? nullableString(post.postId) ?? nullableString(post.latePostId);
  if (!id) return null;
  return {
    id,
    content: string(post.content),
    status: string(post.status) || 'published',
    publishedAt: nullableString(post.publishedAt),
    scheduledFor: nullableString(post.scheduledFor),
    mediaType: nullableString(post.mediaType),
    platformPostUrl: url(post.platformPostUrl),
    metrics: metrics(post.analytics),
  };
}

function scheduledPost(value: unknown): SocialPost | null {
  const post = object(value);
  const id = nullableString(post._id);
  if (!id) return null;
  const media = object(array(post.mediaItems)[0]);
  const platform = object(array(post.platforms)[0]);
  return {
    id,
    content: string(post.content),
    status: string(post.status) || string(platform.status) || 'scheduled',
    publishedAt: nullableString(platform.publishedAt),
    scheduledFor: nullableString(post.scheduledFor),
    mediaType: nullableString(media.type),
    platformPostUrl: url(platform.platformPostUrl),
    metrics: metrics(platform.analytics),
  };
}

export function presentPostTimeline(payload: unknown) {
  return array(object(payload).timeline)
    .map((value) => {
      const row = object(value);
      return {
        date: string(row.date),
        views: number(row.views),
        reach: number(row.reach),
      };
    })
    .filter((row) => row.date.length > 0);
}

function hashtags(posts: SocialPost[]) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const match of post.content.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
      const tag = `#${match[1].toLowerCase()}`;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
}

export function presentSocialDashboard(
  accountsPayload: unknown,
  analyticsPayload: unknown,
  scheduledPayload: unknown,
  dailyPayload: unknown,
  bestTimePayload: unknown,
  rangeDays: number,
) {
  const accountData = object(array(object(accountsPayload).accounts)[0]);
  const account = nullableString(accountData._id)
    ? {
        username: string(accountData.username),
        displayName: string(accountData.displayName),
        profilePicture: url(accountData.profilePicture),
        profileUrl: url(accountData.profileUrl),
        followers: number(accountData.followersCount),
        connected: boolean(accountData.isActive) && !boolean(accountData.needsReconnection),
        needsReconnection: boolean(accountData.needsReconnection),
      }
    : null;

  const analytics = object(analyticsPayload);
  const posts = array(analytics.posts)
    .map(analyticsPost)
    .filter((post) => post !== null);
  const seen = new Set(posts.map((post) => post.id));
  for (const post of array(object(scheduledPayload).posts).map(scheduledPost)) {
    if (post && !seen.has(post.id)) posts.push(post);
  }
  posts.sort((a, b) =>
    (b.publishedAt ?? b.scheduledFor ?? '').localeCompare(a.publishedAt ?? a.scheduledFor ?? ''),
  );

  const totals = posts.reduce(
    (sum, post) => ({
      reach: sum.reach + post.metrics.reach,
      impressions: sum.impressions + post.metrics.impressions,
      views: sum.views + post.metrics.views,
      engagements:
        sum.engagements +
        post.metrics.likes +
        post.metrics.comments +
        post.metrics.shares +
        post.metrics.saves,
    }),
    { reach: 0, impressions: 0, views: 0, engagements: 0 },
  );
  const overview = object(analytics.overview);
  const daily = array(object(dailyPayload).dailyData).map((value) => {
    const row = object(value);
    const rowMetrics = object(row.metrics);
    return {
      date: string(row.date),
      reach: number(rowMetrics.reach),
      impressions: number(rowMetrics.impressions),
      views: number(rowMetrics.views),
      engagements:
        number(rowMetrics.likes) +
        number(rowMetrics.comments) +
        number(rowMetrics.shares) +
        number(rowMetrics.saves),
    };
  });

  return {
    rangeDays,
    syncedAt:
      nullableString(overview.lastSync) ?? nullableString(accountData.analyticsLastSyncedAt),
    account,
    summary: {
      ...totals,
      engagementRate: totals.reach > 0 ? (totals.engagements / totals.reach) * 100 : 0,
      followers: account?.followers ?? 0,
      publishedPosts: posts.filter((post) => post.status === 'published').length,
      scheduledPosts: posts.filter((post) => post.status === 'scheduled').length,
    },
    daily,
    posts,
    hashtags: hashtags(posts),
    bestTimes: array(object(bestTimePayload).slots)
      .map((value) => {
        const slot = object(value);
        return {
          day: Math.min(6, Math.floor(number(slot.day_of_week))),
          hour: Math.min(23, Math.floor(number(slot.hour))),
          averageEngagement: number(slot.avg_engagement),
          postCount: Math.floor(number(slot.post_count)),
        };
      })
      .slice(0, 4),
  };
}
