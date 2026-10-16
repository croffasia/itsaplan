import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IssueAgentRun } from '@/lib/api/endpoints/issues';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { formatDateTime } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { AgentContextSize } from '@/components/common/agent-chat/AgentContextSize';
import IssueAgentRunBlock from './IssueAgentRunBlock';
import IssueAgentRunTrace from './IssueAgentRunTrace';

export default function IssueAgentRunItem({ issueId, run }: { issueId: number; run: IssueAgentRun }) {
  const t = useTranslations('issue.agentRuns');
  const relativeTime = useRelativeTime();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-2 py-3 text-start text-xs hover:bg-accent/50"
      >
        <Chevron className="size-3.5 shrink-0" />
        <span className="font-medium">@{run.username}</span>
        <Badge variant={run.status === 'failed' ? 'destructive' : 'outline'}>
          {t(run.status)}
        </Badge>
        <span className="text-muted-foreground">
          #{run.id} · {t(`triggers.${run.trigger}`)}
        </span>
        {run.contextTokens != null && <AgentContextSize tokens={run.contextTokens} />}
        <time
          className="ms-auto text-muted-foreground"
          dateTime={run.createdAt}
          title={formatDateTime(run.createdAt)}
        >
          {relativeTime(run.createdAt)}
        </time>
      </button>
      {open && (
        <div className="space-y-3 pb-4">
          <p className="text-xs text-muted-foreground">{t('attempts', { count: run.attempts })}</p>
          {run.startedAt && (
            <p className="text-xs text-muted-foreground">
              {t('started', { date: formatDateTime(run.startedAt) })}
            </p>
          )}
          {run.finishedAt && (
            <p className="text-xs text-muted-foreground">
              {t('finished', { date: formatDateTime(run.finishedAt) })}
            </p>
          )}
          {run.status === 'pending' && (
            <p className="text-xs text-muted-foreground">{t('pendingHint')}</p>
          )}
          <IssueAgentRunBlock label={t('task')} value={run.prompt} />
          <IssueAgentRunBlock label={t('error')} value={run.lastError} />
          <IssueAgentRunBlock label={t('result')} value={run.output} />
          {run.kind === 'internal' ? (
            <IssueAgentRunTrace issueId={issueId} runId={run.id} />
          ) : (
            <p className="text-xs text-muted-foreground">{t('externalHint')}</p>
          )}
        </div>
      )}
    </div>
  );
}
