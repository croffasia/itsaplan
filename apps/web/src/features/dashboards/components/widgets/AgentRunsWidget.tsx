import Link from 'next/link';
import { formatDateTime } from '@/utils/dates';
import { issuePath } from '@/utils/paths';
import type { AgentRunFeedItem } from '@/lib/api';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentRunsQuery } from '../../services/analytics.service';

export const STATUS_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'All runs' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Queued' },
  { value: 'success', label: 'Succeeded' },
];

function statusVariant(status: AgentRunFeedItem['status']) {
  switch (status) {
    case 'success':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function triggerLabel(trigger: AgentRunFeedItem['trigger']): string {
  if (trigger === 'mention') return 'ran on mention in';
  if (trigger === 'delegation') return 'ran on delegation of';
  if (trigger === 'manual') return 'ran manually';
  return 'ran on schedule';
}

// Project-wide feed of AI agent runs, newest first, optionally narrowed to one
// status. Issue-triggered rows link to the issue; scheduled rows show their
// trigger. A failed run shows its error.
export default function AgentRunsWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const status = config.runStatus ?? null;
  const limit = config.limit ?? 20;
  const { data, isLoading } = useAgentRunsQuery(projectKey, { status, limit });
  const items = data ?? [];

  const caption = STATUS_FILTER.find((o) => o.value === (status ?? 'all'))?.label ?? 'All runs';

  function feed() {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      );
    }
    if (items.length === 0) {
      return <p className="py-6 text-center text-sm text-muted-foreground">No agent runs yet.</p>;
    }
    return (
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-sm">
            <Badge variant={statusVariant(r.status)} className="mt-0.5 shrink-0 capitalize">
              {r.status === 'pending' ? 'queued' : r.status}
            </Badge>
            <div className="min-w-0 flex-1">
              <span className="text-foreground/80">{r.agentName}</span>{' '}
              <span className="text-muted-foreground">{triggerLabel(r.trigger)}</span>{' '}
              {r.issueId != null && r.issueSequence != null && (
                <Link href={issuePath(projectKey, r.issueSequence)} className="hover:underline">
                  {projectKey}-{r.issueSequence}
                </Link>
              )}
              <span className="ml-1 text-xs text-muted-foreground/70">
                {formatDateTime(r.createdAt)}
              </span>
              {r.status === 'failed' && r.lastError && (
                <p className="mt-0.5 truncate text-xs text-destructive">{r.lastError}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{caption}</p>
      {feed()}
    </div>
  );
}
