'use client';

import { Instagram, Star } from 'lucide-react';
import { Area, AreaChart } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import type { SocialDashboard, SocialPost } from '@/lib/api';
import { compactNumber, mediaLabel, percent, postTitle, socialDate } from '../utils/social';

const config = { value: { label: 'Performance', color: 'var(--primary)' } } satisfies ChartConfig;

export default function SocialFeaturedPostCard({
  post,
  timeline,
  username,
  rangeDays,
}: {
  post: SocialPost;
  timeline: SocialDashboard['featuredTimeline'];
  username: string | null;
  rangeDays: number;
}) {
  const chart = timeline.map((point) => ({
    date: point.date,
    value: point.views > 0 ? point.views : point.reach,
  }));
  const stats = [
    ['Views', compactNumber(post.metrics.views)],
    ['Likes', compactNumber(post.metrics.likes)],
    ['Comments', compactNumber(post.metrics.comments)],
    ['Engagement', percent(post.metrics.engagementRate)],
  ];

  return (
    <Card className="overflow-hidden py-0 shadow-none">
      <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <CardContent className="flex min-h-64 flex-col p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium tracking-wide uppercase">
              <Star className="size-3.5" /> Top post · {rangeDays}d
            </span>
            <Badge variant="outline" className="gap-1 border-primary/25 text-foreground">
              <Instagram className="size-3" /> IG
            </Badge>
            <span className="tracking-wide uppercase">{mediaLabel(post.mediaType)}</span>
            <Badge variant="secondary" className="capitalize">
              <span className="size-1.5 rounded-full bg-emerald-500" /> {post.status}
            </Badge>
          </div>
          <h3 className="mt-5 text-lg leading-snug font-semibold">{postTitle(post)}</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {username ? `@${username}` : 'Instagram'} · Instagram · {socialDate(post.publishedAt)}
          </p>
          <div className="mt-auto pt-5">
            {chart.length > 1 ? (
              <ChartContainer config={config} className="h-20 w-full">
                <AreaChart data={chart}>
                  <Area
                    dataKey="value"
                    type="monotone"
                    fill="var(--color-value)"
                    fillOpacity={0.1}
                    stroke="var(--color-value)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="text-xs text-muted-foreground">
                More daily data is needed for the performance trend.
              </p>
            )}
          </div>
        </CardContent>
        <div className="grid grid-cols-2 border-t md:border-t-0 md:border-l">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="flex min-h-28 flex-col justify-center border-b p-5 odd:border-r"
            >
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
              <p className="mt-1 text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
