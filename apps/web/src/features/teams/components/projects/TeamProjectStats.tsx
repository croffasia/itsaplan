'use client';

import { useTranslations } from 'next-intl';
import type { AnalyticsStats } from '@/lib/api/endpoints/analytics';

// How the project's issues stand, in the order a team owner reads them: what is left
// to do, what moves, and what needs attention.
const STATS = [
  'open',
  'inProgress',
  'backlog',
  'overdue',
  'unassigned',
  'closedLast7d',
] as const satisfies (keyof AnalyticsStats)[];

export default function TeamProjectStats({ stats }: { stats: AnalyticsStats }) {
  const t = useTranslations('teams.panel.stats');

  return (
    <div className="grid grid-cols-3 gap-2">
      {STATS.map((key) => (
        <div key={key} className="rounded-lg bg-muted/40 px-3 py-2.5">
          <div className="text-lg font-semibold tabular-nums">{stats[key]}</div>
          <div className="text-xs text-muted-foreground">{t(key)}</div>
        </div>
      ))}
    </div>
  );
}
