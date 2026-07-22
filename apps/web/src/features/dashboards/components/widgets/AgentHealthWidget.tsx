import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentRunStatsQuery } from '../../services/analytics.service';

// Agent run health over a window: the success rate as the headline figure, with the
// finished-run total and the failed and queued counts underneath. The window is
// configured from the header popover. The success rate is over finished runs
// (success + failed), so pending runs do not drag it down.
export default function AgentHealthWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const days = config.days ?? 30;
  const { data, isLoading } = useAgentRunStatsQuery(projectKey, days);

  if (isLoading || !data) return <Skeleton className="h-10 w-20" />;

  const finished = data.success + data.failed;
  const rate = finished > 0 ? Math.round((data.success / finished) * 100) : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Last {days} days</p>
      {data.total === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No agent runs.</p>
      ) : (
        <>
          <div className="text-4xl font-semibold tracking-tight tabular-nums">
            {rate == null ? '—' : `${rate}%`}
          </div>
          <p className="text-xs text-muted-foreground">success rate</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
            <span>{data.total} runs</span>
            {data.failed > 0 && <span className="text-destructive">{data.failed} failed</span>}
            {data.pending > 0 && <span>{data.pending} queued</span>}
          </div>
        </>
      )}
    </div>
  );
}
