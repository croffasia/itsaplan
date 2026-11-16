import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { compactTokens } from '@/utils/compactTokens';
import RunnerQueueRunFactList, { type RunFact } from './RunnerQueueRunFactList';

// What the run cost in context, and its number.
export default function RunnerQueueRunCost({
  run,
  className,
}: {
  run: RunnerQueueRun;
  className?: string;
}) {
  const t = useTranslations('issue.agentRuns');
  const facts: RunFact[] = [];
  if (run.contextTokens != null) {
    facts.push([
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
    ]);
  }
  facts.push([
    t('facts.run'),
    <span key="run" className="tabular-nums">
      #{run.id}
    </span>,
  ]);
  return <RunnerQueueRunFactList facts={facts} className={className} />;
}
