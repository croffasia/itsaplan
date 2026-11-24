import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { useRunFacts } from '../hooks/useRunFacts';
import { useRunOriginFacts } from '../hooks/useRunOriginFacts';
import { useRunTimeFacts } from '../hooks/useRunTimeFacts';
import { useRunUsageFacts } from '../hooks/useRunUsageFacts';
import type { RunFactKey } from '../types/runFact';

// What the bar and the header over the facts already say.
const SAID_ABOVE: RunFactKey[] = ['status', 'workItem', 'run'];

// The run's properties in the side panel: one grid, with each name over its value.
export default function RunnerQueueRunFactGrid({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  const facts = [
    ...useRunFacts(run),
    ...useRunOriginFacts(run),
    ...useRunTimeFacts(run),
    ...useRunUsageFacts(run),
  ].filter(([key]) => !SAID_ABOVE.includes(key));

  return (
    <dl
      aria-label={t('details')}
      className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm @lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]"
    >
      {facts.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t(`facts.${key}`)}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
