import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/utils/dates';

export default function RunnerQueueListItem({
  run,
  selected,
  onSelect,
}: {
  run: RunnerQueueRun;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('issue.agentRuns');
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'w-full space-y-2 border-b p-4 text-start hover:bg-accent/50',
        selected && 'bg-accent',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          @{run.username} · #{run.id}
        </span>
        <Badge variant={run.status === 'failed' ? 'destructive' : 'outline'}>
          {t(run.executionState)}
        </Badge>
      </div>
      <p className="line-clamp-2 text-sm">{run.issueTitle ?? run.prompt}</p>
      <p className="text-xs text-muted-foreground">
        {run.projectRef} · {formatDateTime(run.createdAt)}
      </p>
    </button>
  );
}
