'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import SectionPageView from '@/components/common/page/SectionPageView';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import SocialAccountCard from './components/SocialAccountCard';
import SocialBestTimesCard from './components/SocialBestTimesCard';
import SocialErrorState from './components/SocialErrorState';
import SocialFeaturedPostCard from './components/SocialFeaturedPostCard';
import SocialHashtagsCard from './components/SocialHashtagsCard';
import SocialPostCard from './components/SocialPostCard';
import SocialPostsToolbar, { type SocialPostFilter } from './components/SocialPostsToolbar';
import SocialSummaryCards from './components/SocialSummaryCards';
import SocialTrendCard from './components/SocialTrendCard';
import { useSocialDashboardQuery } from './services/social.service';
import { filterSocialPosts } from './utils/social';

export default function SocialPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const dashboardQuery = useSocialDashboardQuery(projectKey);
  const [filter, setFilter] = useState<SocialPostFilter>('all');
  const [search, setSearch] = useState('');
  const data = dashboardQuery.data;
  const posts = useMemo(
    () => filterSocialPosts(data?.posts ?? [], filter, search),
    [data?.posts, filter, search],
  );

  if (!project || dashboardQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('social', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Social.
      </div>
    );
  }
  if (dashboardQuery.isError || !data) {
    return <SocialErrorState onRetry={() => void dashboardQuery.refetch()} />;
  }

  const counts = {
    all: data.posts.length,
    published: data.posts.filter((post) => post.status === 'published').length,
    scheduled: data.posts.filter((post) => post.status === 'scheduled').length,
  };
  const featuredPost = posts.find((post) => post.id === data.featuredPostId) ?? null;
  const regularPosts = featuredPost ? posts.filter((post) => post.id !== featuredPost.id) : posts;
  const username = data.account?.username ?? null;

  return (
    <SectionPageView
      title="Social"
      description="Instagram performance and publishing status from your connected Zernio account."
      actions={<Badge variant="outline">Last {data.rangeDays} days</Badge>}
      wide
    >
      <div className="space-y-6 pb-8">
        <SocialSummaryCards summary={data.summary} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SocialAccountCard data={data} />
          <SocialTrendCard daily={data.daily} />
        </div>
        <section className="space-y-4">
          <div>
            <h2 className="font-semibold">Recent posts</h2>
            <p className="text-sm text-muted-foreground">
              Published and scheduled Instagram content in this period.
            </p>
          </div>
          <SocialPostsToolbar
            filter={filter}
            search={search}
            counts={counts}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
          />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            {posts.length > 0 ? (
              <div className="space-y-4">
                {featuredPost && (
                  <SocialFeaturedPostCard
                    post={featuredPost}
                    timeline={data.featuredTimeline}
                    username={username}
                    rangeDays={data.rangeDays}
                  />
                )}
                {regularPosts.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {regularPosts.map((post) => (
                      <SocialPostCard key={post.id} post={post} username={username} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-xl border text-sm text-muted-foreground">
                No posts match these filters.
              </div>
            )}
            <aside className="space-y-4">
              <SocialBestTimesCard bestTimes={data.bestTimes} />
              <SocialHashtagsCard hashtags={data.hashtags} />
            </aside>
          </div>
        </section>
      </div>
    </SectionPageView>
  );
}
