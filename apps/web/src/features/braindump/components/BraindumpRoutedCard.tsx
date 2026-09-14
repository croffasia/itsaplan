import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BraindumpStats } from '@/lib/api';
import { DESTINATION_META } from '../utils/braindump';
import BraindumpDestinationBar from './BraindumpDestinationBar';

const ROW_LABELS: Record<string, string> = {
  obsidian: DESTINATION_META.obsidian.target,
  issue: DESTINATION_META.issue.target,
  schedule: DESTINATION_META.schedule.target,
  unsorted: 'Unsorted',
};

export default function BraindumpRoutedCard({ stats }: { stats: BraindumpStats }) {
  const rows = [...stats.byDestination].sort((a, b) => b.count - a.count);
  const busiest = Math.max(...rows.map((row) => row.count), 1);

  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Filed today
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{stats.routedToday}</p>
        <p className="mt-1 border-b pb-3 text-xs text-muted-foreground">
          Dumps filed · <span className="font-medium text-foreground">{stats.unsorted}</span>{' '}
          unsorted
        </p>
        <div className="mt-3 space-y-2">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing captured yet.</p>
          ) : (
            rows.map((row) => (
              <BraindumpDestinationBar
                key={row.destination}
                label={ROW_LABELS[row.destination] ?? row.destination}
                count={row.count}
                share={row.count / busiest}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
