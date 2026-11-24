import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInternalRunTraceQuery } from '@/services/runnerQueue.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { internalTraceParts } from './internalTraceParts';
import AgentRunAttempts from './AgentRunAttempts';
import AgentRunSteps from './AgentRunSteps';

// An internal run's steps, laid out as an external run's transcript is.
export default function AgentRunInternalTrace({ runId }: { runId: number }) {
  const t = useTranslations('issue.agentRuns');
  const [attempt, setAttempt] = useState<number>();
  const latest = useInternalRunTraceQuery(runId);
  const query = useInternalRunTraceQuery(runId, attempt);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.internalRunTrace(runId)] });
  const detail = query.isError ? null : query.data;
  const count = (latest.isError ? null : latest.data?.attempts) ?? 1;
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
      {query.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="alert" className="text-xs text-destructive">
            {t('stepsLoadError')}
          </p>
          {attempt != null && attempts}
        </div>
      )}
      {query.isSuccess && !detail && (
        <p className="text-sm text-muted-foreground">{t('noTrace')}</p>
      )}
      {detail && <AgentRunSteps parts={internalTraceParts(detail.spans)} controls={attempts} />}
    </div>
  );
}
