import { AlertTriangle } from 'lucide-react';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebhookStatsQuery } from '../../services/analytics.service';

// Webhook delivery health over a window: the delivered total as the headline figure,
// with the failed and pending counts, plus a warning when subscriptions have been
// auto-disabled by the worker (a dead endpoint). The window is configured from the
// header popover.
export default function WebhookHealthWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const days = config.days ?? 30;
  const { data, isLoading } = useWebhookStatsQuery(projectKey, days);

  if (isLoading || !data) return <Skeleton className="h-10 w-20" />;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Last {days} days</p>
      <div className="text-4xl font-semibold tracking-tight tabular-nums">{data.total}</div>
      <p className="text-xs text-muted-foreground">deliveries</p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        {data.failed > 0 && <span className="text-destructive">{data.failed} failed</span>}
        {data.pending > 0 && <span>{data.pending} pending</span>}
        {data.failed === 0 && data.pending === 0 && <span>all delivered</span>}
      </div>
      {data.disabledWebhooks > 0 && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          {data.disabledWebhooks} disabled endpoint{data.disabledWebhooks === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
