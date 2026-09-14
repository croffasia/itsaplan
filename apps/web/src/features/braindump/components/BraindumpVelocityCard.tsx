import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BraindumpStats } from '@/lib/api';
import Sparkline from '@/components/common/Sparkline';

export default function BraindumpVelocityCard({ stats }: { stats: BraindumpStats }) {
  const values = stats.daily.map((day) => day.count);
  const peak = Math.max(...values, 0);

  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-center justify-between px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Capture velocity · {stats.daily.length} days
        </CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">peak {peak}/d</span>
      </CardHeader>
      <CardContent className="px-5">
        <Sparkline
          values={values}
          label={`Captures per day over the last ${stats.daily.length} days`}
        />
        <div className="mt-3 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>
            Dumps / day · <span className="font-medium text-foreground">{stats.averagePerDay}</span>
          </span>
          <span>
            <span className="font-medium text-foreground tabular-nums">{stats.total}</span> in this
            window
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
