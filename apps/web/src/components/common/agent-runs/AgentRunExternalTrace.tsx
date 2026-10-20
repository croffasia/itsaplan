import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useExternalRunTraceQuery } from '@/services/runnerQueue.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { externalTraceParts } from './externalTraceParts';
import AgentRunStep from './AgentRunStep';

export default function AgentRunExternalTrace({ runId }: { runId: number }) {
  const t = useTranslations('issue.agentRuns');
  const [attempt, setAttempt] = useState<number>();
  const query = useExternalRunTraceQuery(runId, attempt);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.externalRunTrace(runId)] });
  const trace = query.isError ? null : query.data;
  return (
    <div className="space-y-2">
      {query.isLoading && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {t('loadError')}
        </p>
      )}
      {query.isSuccess && !trace && (
        <p className="text-sm text-muted-foreground">{t('externalHint')}</p>
      )}
      {trace && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t('externalAttempt', { attempt: trace.attempt })}</span>
            {trace.previousAttempt != null && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setAttempt(trace.previousAttempt ?? undefined)}
              >
                <ChevronLeft />
                {t('previousAttempt')}
              </Button>
            )}
            {attempt != null && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setAttempt(undefined)}
              >
                {t('latestAttempt')}
              </Button>
            )}
            {trace.sessionUrl && (
              <a
                className="ms-auto text-primary underline"
                href={trace.sessionUrl}
                title={t('sessionHint')}
              >
                {t('openCodex')}
              </a>
            )}
          </div>
          {trace.truncated && (
            <p role="status" className="text-xs text-muted-foreground">
              {t('traceTruncated')}
            </p>
          )}
          <ol>
            {externalTraceParts(trace.events).map((part, index) => (
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
