import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useExternalRunTraceQuery } from '@/services/runnerQueue.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { externalTraceParts } from './externalTraceParts';
import AgentRunAttempts from './AgentRunAttempts';
import AgentRunSteps from './AgentRunSteps';

// The latest attempt's number is how many attempts the picker offers. An attempt the
// runner sent no events for has no transcript.
export default function AgentRunExternalTrace({ runId }: { runId: number }) {
  const t = useTranslations('issue.agentRuns');
  const [attempt, setAttempt] = useState<number>();
  const latest = useExternalRunTraceQuery(runId);
  const query = useExternalRunTraceQuery(runId, attempt);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.externalRunTrace(runId)] });
  const trace = query.isError ? null : query.data;
  const count = (latest.isError ? null : latest.data?.attempt) ?? 1;
  const attempts = (
    <AgentRunAttempts
      count={count}
      current={attempt ?? count}
      onSelect={(picked) => setAttempt(picked === count ? undefined : picked)}
    />
  );
  return (
    <div className="space-y-2">
      {query.isLoading && <p className="text-xs text-muted-foreground">{t('loadingSteps')}</p>}
      {query.isError &&
        (attempt == null ? (
          <p role="alert" className="text-xs text-destructive">
            {t('stepsLoadError')}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('attemptNotRecorded')}</p>
            {attempts}
          </div>
        ))}
      {query.isSuccess && !trace && (
        <p className="text-sm text-muted-foreground">{t('externalHint')}</p>
      )}
      {trace?.truncated && (
        <p role="status" className="text-xs text-muted-foreground">
          {t('traceTruncated')}
        </p>
      )}
      {trace && (
        <AgentRunSteps
          parts={externalTraceParts(trace.events)}
          controls={
            <>
              {attempts}
              {trace.sessionUrl && (
                <a
                  className="text-xs text-primary underline"
                  href={trace.sessionUrl}
                  title={t('sessionHint')}
                >
                  {t('openCodex')}
                </a>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
