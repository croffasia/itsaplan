import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useIssueAgentRunTraceQuery } from '@/services/issues.service';
import { formatDateTime } from '@/utils/dates';
import AgentRunBlock from './AgentRunBlock';

export default function AgentRunTrace({ issueId, runId }: { issueId: number; runId: number }) {
  const t = useTranslations('issue.agentRuns');
  const [traceId, setTraceId] = useState<string>();
  const query = useIssueAgentRunTraceQuery(issueId, runId, traceId);
  const detail = query.isError ? null : query.data;
  const previousTraceId = detail?.previousTraceId;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">{t(traceId == null ? 'trace' : 'recordedAttempt')}</p>
        <div className="flex items-center gap-2">
          {traceId != null && (
            <Button size="sm" variant="ghost" onClick={() => setTraceId(undefined)}>
              {t('latestAttempt')}
            </Button>
          )}
          {previousTraceId && (
            <Button size="sm" variant="ghost" onClick={() => setTraceId(previousTraceId)}>
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
      </div>
      {query.isLoading && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {t('loadError')}
        </p>
      )}
      {query.isSuccess && detail == null && (
        <p className="text-xs text-muted-foreground">{t('noTrace')}</p>
      )}
      {detail && (
        <p className="text-xs text-muted-foreground">
          {t('attemptStarted', { date: formatDateTime(detail.trace.startedAt) })}
        </p>
      )}
      {detail?.spans.map((span) => (
        <details key={span.spanId} className="rounded-md border p-3">
          <summary className="cursor-pointer text-xs">
            <span dir="auto">{span.name}</span> · {span.type} · {span.status}
            {span.durationMs != null && (
              <> · {t('duration', { milliseconds: span.durationMs })}</>
            )}
          </summary>
          <div className="mt-3 space-y-3">
            <AgentRunBlock label={t('input')} value={span.input} />
            <AgentRunBlock label={t('result')} value={span.output} />
            <AgentRunBlock label={t('error')} value={span.error} />
            <AgentRunBlock label={t('attributes')} value={span.attributes} />
          </div>
        </details>
      ))}
    </div>
  );
}
