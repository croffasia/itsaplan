import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { compactTokens } from '@/utils/compactTokens';
import type { RunFact } from '../components/RunnerQueueRunFactList';

// What the run took of the model's context, none until the run reports it.
export function useRunUsageFacts(run: RunnerQueueRun): RunFact[] {
  const t = useTranslations('issue.agentRuns');
  if (run.contextTokens == null) return [];
  return [
    [
      t('facts.context'),
      <span key="context" className="space-y-0.5">
        <span className="block">
          {t('contextTokens', { size: compactTokens(run.contextTokens) })}
        </span>
        {run.inputTokens != null && run.outputTokens != null && (
          <span className="block text-xs text-muted-foreground">
            {t('tokensSplit', {
              input: compactTokens(run.inputTokens),
              output: compactTokens(run.outputTokens),
            })}
          </span>
        )}
      </span>,
    ],
  ];
}
