import AgentRunExternalTrace from '@/components/common/agent-runs/AgentRunExternalTrace';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AgentRun } from '@/lib/api/endpoints/agents';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { formatDateTime } from '@/utils/dates';
import { AgentContextSize } from '@/components/common/agent-chat/AgentContextSize';
import AgentRunBlock from '@/components/common/agent-runs/AgentRunBlock';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import TeamAiAgentRunStatus from './TeamAiAgentRunStatus';

function runSubject(r: AgentRun, t: ReturnType<typeof useTranslations<'teams.agents'>>): string {
  if (r.issueId == null) return r.trigger === 'manual' ? t('manualTask') : t('scheduledTask');
  if (!r.issueIdentifier) return `issue #${r.issueId}`;
  return `${r.issueIdentifier}${r.issueTitle ? ` · ${r.issueTitle}` : ''}`;
}

export default function TeamAiAgentRunItem({
  run: r,
  external,
}: {
  run: AgentRun;
  external: boolean;
}) {
  const t = useTranslations('teams.agents');
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
        <TeamAiAgentRunStatus status={r.executionState} />
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
          <AgentRunBlock label={t('task')} value={r.prompt} />
          {r.status === 'failed' && r.lastError && (
            <AgentRunBlock label={t('error')} value={r.lastError} />
          )}
          {r.output && <AgentRunBlock label={t('result')} value={r.output} />}
          {r.executionState === 'queued' && (
            <AgentRunBlock
              label={t('queue')}
              value={`Attempts: ${r.attempts}. Next attempt: ${formatDateTime(r.nextAttemptAt)}.`}
            />
          )}
          {external && <AgentRunExternalTrace runId={r.id} />}
          {outcome && <p className="text-xs text-muted-foreground">{outcome}</p>}
        </div>
      )}
    </div>
  );
}
