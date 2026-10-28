import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useInternalRunTraceQuery } from '@/services/runnerQueue.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { formatDateTime } from '@/utils/dates';
import { internalTraceParts } from './internalTraceParts';
import AgentRunStep from './AgentRunStep';

// An internal run's steps, laid out as an external run's transcript is.
export default function AgentRunInternalTrace({ runId }: { runId: number }) {
  const t = useTranslations('issue.agentRuns');
  const [traceId, setTraceId] = useState<string>();
  const query = useInternalRunTraceQuery(runId, traceId);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.internalRunTrace(runId)] });
  const detail = query.isError ? null : query.data;
  return (
    <div className="space-y-2">
      {query.isLoading && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {t('loadError')}
        </p>
      )}
      {query.isSuccess && !detail && (
        <p className="text-sm text-muted-foreground">{t('noTrace')}</p>
      )}
      {detail && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t('attemptStarted', { date: formatDateTime(detail.trace.startedAt) })}</span>
            {detail.previousTraceId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setTraceId(detail.previousTraceId ?? undefined)}
              >
                <ChevronLeft />
                {t('previousAttempt')}
              </Button>
            )}
            {traceId != null && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setTraceId(undefined)}
              >
                {t('latestAttempt')}
              </Button>
            )}
          </div>
          <ol>
            {internalTraceParts(detail.spans).map((part, index) => (
              <li key={index}>
                <AgentRunStep part={part} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
