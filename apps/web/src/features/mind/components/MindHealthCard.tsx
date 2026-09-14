import { AlertTriangle, Check, Clock, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MindOverview } from '@/lib/api';

function Row({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Check;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="font-medium tabular-nums">{value}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>
    </li>
  );
}

export default function MindHealthCard({
  health,
  staleAfterDays,
  onReviewStale,
  reviewingStale,
}: {
  health: MindOverview['health'];
  staleAfterDays: number;
  onReviewStale: () => void;
  reviewingStale: boolean;
}) {
  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-baseline justify-between px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Memory health
        </CardTitle>
        <span className="text-xs text-muted-foreground">needs a look</span>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        <ul className="space-y-2.5">
          <Row
            icon={AlertTriangle}
            label={health.conflicted === 1 ? 'conflict to resolve' : 'conflicts to resolve'}
            value={health.conflicted}
            detail="flagged"
          />
          <Row
            icon={Clock}
            label="facts going stale"
            value={health.stale}
            detail={`> ${staleAfterDays} days`}
          />
          <Row
            icon={Unlink}
            label="orphans, nothing links them"
            value={health.orphans}
            detail="unlinked"
          />
          <Row icon={Check} label="facts verified" value={health.verified} detail="trusted" />
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={health.stale === 0}
          onClick={onReviewStale}
        >
          {reviewingStale ? 'Show everything again' : 'Review stale facts'}
        </Button>
      </CardContent>
    </Card>
  );
}
