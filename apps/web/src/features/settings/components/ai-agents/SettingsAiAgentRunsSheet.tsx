import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentRun, AiAgent } from '@/lib/api';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { formatDateTime } from '@/utils/dates';
import { useAgentRuns } from '@/services/aiAgents.service';
import { AgentContextSize } from '@/components/common/agent-chat/AgentContextSize';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

// Run history for an agent, in a right-side sidebar. Shows the triggered runs (a
// mention, a delegation, or a member field) queued for the agent, newest first, 25 at
// a time. Each run expands to show the task it was given and, if it failed, the
// error. Test-chat runs are not recorded, so they never appear here.
export function SettingsAiAgentRunsSheet({
  projectKey,
  agent,
  onClose,
}: {
  projectKey: string;
  agent: AiAgent | null;
  onClose: () => void;
}) {
  const t = useTranslations('settings.agents');
  return (
    <Sheet open={agent != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('runHistory')}</SheetTitle>
          <SheetDescription className="truncate text-xs">
            {agent ? t('runsSubtitle', { username: agent.username }) : ''}
          </SheetDescription>
        </SheetHeader>
        {agent && <RunsList projectKey={projectKey} agentId={agent.id} />}
      </SheetContent>
    </Sheet>
  );
}

function RunsList({ projectKey, agentId }: { projectKey: string; agentId: number }) {
  const t = useTranslations('settings.agents');
  const tCommon = useTranslations('common');
  const query = useAgentRuns(projectKey, agentId);
  const runs = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading) {
    return <ListSkeleton rows={4} className="p-4" rowClassName="h-12" />;
  }
  if (runs.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t('noRuns')}</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="divide-y divide-border/50">
        {runs.map((r) => (
          <RunItem key={r.id} run={r} />
        ))}
      </div>
      <div className="p-4">
        {query.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? tCommon('loading') : t('loadMore')}
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">{t('endOfHistory')}</p>
        )}
      </div>
    </div>
  );
}

// What the run was about: the issue it targeted, or how it was started when it
// targeted none.
function runSubject(r: AgentRun, t: ReturnType<typeof useTranslations<'settings.agents'>>): string {
  if (r.issueId == null) return r.trigger === 'manual' ? t('manualTask') : t('scheduledTask');
  if (!r.issueIdentifier) return `issue #${r.issueId}`;
  return `${r.issueIdentifier}${r.issueTitle ? ` · ${r.issueTitle}` : ''}`;
}

function RunItem({ run: r }: { run: AgentRun }) {
  const t = useTranslations('settings.agents');
  const relativeTime = useRelativeTime();
  const [open, setOpen] = useState(false);
  const subject = runSubject(r, t);
  const outcome = r.status === 'failed' ? (r.lastError ?? t('failed')) : '';
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-xs hover:bg-accent/50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        <StatusBadge status={r.status} />
        <span className="shrink-0 text-muted-foreground capitalize">{r.trigger}</span>
        <span className="truncate font-medium">{subject}</span>
        {r.attempts > 1 && (
          <span className="shrink-0 text-muted-foreground">·{r.attempts} attempts</span>
        )}
        <span className="ms-auto flex shrink-0 items-center gap-4">
          <span className="w-12 text-end">
            {r.contextTokens !== undefined && <AgentContextSize tokens={r.contextTokens} />}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground">{relativeTime(r.createdAt)}</span>
            </TooltipTrigger>
            <TooltipContent>{formatDateTime(r.createdAt)}</TooltipContent>
          </Tooltip>
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-3">
          <DetailBlock label={t('task')} value={r.prompt} />
          {r.status === 'failed' && r.lastError && (
            <DetailBlock label={t('error')} value={r.lastError} />
          )}
          {r.output && <DetailBlock label={t('result')} value={r.output} />}
          {r.status === 'pending' && (
            <DetailBlock
              label={t('queue')}
              value={`Attempts: ${r.attempts}. Next attempt: ${formatDateTime(r.nextAttemptAt)}.`}
            />
          )}
          {outcome && <p className="text-xs text-muted-foreground">{outcome}</p>}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2.5 text-xs whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

const STATUS_VARIANT: Record<AgentRun['status'], 'secondary' | 'destructive' | 'outline'> = {
  success: 'secondary',
  failed: 'destructive',
  pending: 'outline',
  canceled: 'outline',
};

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  const variant = STATUS_VARIANT[status];
  return (
    <Badge variant={variant} className="shrink-0 capitalize">
      {status === 'pending' ? 'queued' : status}
    </Badge>
  );
}
