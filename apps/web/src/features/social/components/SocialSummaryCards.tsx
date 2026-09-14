import { Eye, Radio, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialDashboard } from '@/lib/api';
import { compactNumber, percent } from '../utils/social';

export default function SocialSummaryCards({ summary }: { summary: SocialDashboard['summary'] }) {
  const cards = [
    {
      label: 'Reach',
      value: compactNumber(summary.reach),
      detail: `${compactNumber(summary.impressions)} impressions`,
      icon: Radio,
    },
    {
      label: 'Engagement rate',
      value: percent(summary.engagementRate),
      detail: `${compactNumber(summary.engagements)} interactions`,
      icon: TrendingUp,
    },
    {
      label: 'Followers',
      value: compactNumber(summary.followers),
      detail: 'Instagram audience',
      icon: Users,
    },
    {
      label: 'Content views',
      value: compactNumber(summary.views),
      detail: `${summary.publishedPosts} published posts`,
      icon: Eye,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 py-5 shadow-none">
          <CardHeader className="flex grid-cols-none flex-row items-center justify-between px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
