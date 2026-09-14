import { AlertTriangle, Bell, Radar, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CompetitorOverview } from '@/lib/api';
import { relativeTime } from '../utils/competitors';

export default function CompetitorSummaryCards({ overview }: { overview: CompetitorOverview }) {
  const platforms = overview.byPlatform.length;
  const cards = [
    {
      label: 'Tracked accounts',
      value: String(overview.tracked),
      detail:
        overview.tracked === 0
          ? 'Nothing watched yet'
          : `${overview.active} active · ${platforms} ${platforms === 1 ? 'platform' : 'platforms'}`,
      icon: Radar,
    },
    {
      label: 'New posts · 24h',
      value: String(overview.newPosts24h),
      detail: `${overview.alertsToday} alerts today`,
      icon: Sparkles,
    },
    {
      label: 'Unread alerts',
      value: String(overview.unread),
      detail: overview.unread === 0 ? 'You are caught up' : 'In the feed on the right',
      icon: Bell,
    },
    {
      label: 'Last sync',
      value: relativeTime(overview.lastSyncAt),
      detail:
        overview.failing > 0
          ? `${overview.failing} account(s) failing`
          : 'Every account is reporting',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 py-5 shadow-none">
          <CardHeader className="flex grid-cols-none flex-row items-center justify-between px-5">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
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
