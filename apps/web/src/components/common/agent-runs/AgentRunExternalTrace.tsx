import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import AgentChatToolCall from '@/components/common/agent-chat/AgentChatToolCall';
import { useExternalRunTraceQuery } from '@/services/runnerQueue.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { formatDateTime } from '@/utils/dates';
import { externalTraceParts } from './externalTraceParts';
import AgentRunBlock from './AgentRunBlock';

export default function AgentRunExternalTrace({ runId }: { runId: number }) {
  const t = useTranslations('issue.agentRuns');
  const [attempt, setAttempt] = useState<number>();
  const query = useExternalRunTraceQuery(runId, attempt);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.externalRunTrace(runId)] });
  const trace = query.isError ? null : query.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {attempt != null && (
          <Button size="sm" variant="ghost" onClick={() => setAttempt(undefined)}>
            {t('latestAttempt')}
          </Button>
        )}
        {trace?.previousAttempt != null && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAttempt(trace.previousAttempt ?? undefined)}
          >
            {t('previousAttempt')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('refresh')}
        </Button>
      </div>
      {query.isLoading && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {t('loadError')}
        </p>
      )}
      {query.isSuccess && !trace && (
        <p className="text-xs text-muted-foreground">{t('externalHint')}</p>
      )}
      {trace && (
        <>
          <p className="text-xs text-muted-foreground">
            {t('externalAttempt', { attempt: trace.attempt })}
          </p>
          {trace.sessionUrl && (
            <div className="space-y-1 text-xs">
              <a className="text-primary underline" href={trace.sessionUrl}>
                {t('openCodex')}
              </a>
              <p className="text-muted-foreground">{t('sessionHint')}</p>
            </div>
          )}
          {trace.truncated && (
            <p role="status" className="text-xs text-muted-foreground">
              {t('traceTruncated')}
            </p>
          )}
          {externalTraceParts(trace.events).map((part, index) => (
            <div key={index} className="space-y-1">
              <time className="text-xs text-muted-foreground" dateTime={part.receivedAt}>
                {formatDateTime(part.receivedAt)}
              </time>
              {part.type === 'tool' ? (
                <AgentChatToolCall tool={part} label={part.toolName} withIcon />
              ) : (
                <AgentRunBlock label={t('message')} value={part.text} />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
