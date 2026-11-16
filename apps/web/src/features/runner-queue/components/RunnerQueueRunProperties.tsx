import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import RunnerQueueRunCost from './RunnerQueueRunCost';
import RunnerQueueRunWhen from './RunnerQueueRunWhen';
import RunnerQueueRunWho from './RunnerQueueRunWho';

// The run's properties in three groups. It folds as an issue's properties do, and the fold
// is remembered.
export default function RunnerQueueRunProperties({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  const details = usePersistedOpen('agent-run-details-open');
  const Chevron = details.open ? ChevronDown : ChevronRight;
  return (
    <aside
      aria-label={t('details')}
      className="order-first border-t pt-5 text-sm @5xl:sticky @5xl:top-4 @5xl:order-none @5xl:border-t-0 @5xl:pt-0"
    >
      <button
        type="button"
        aria-expanded={details.open}
        onClick={details.toggle}
        className="flex h-7 items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
      >
        <Chevron aria-hidden className={cn('size-3.5', !details.open && 'rtl:rotate-180')} />
        {t('details')}
      </button>
      {details.open && (
        <div className="mt-3 grid gap-6 @xl:grid-cols-2 @xl:gap-x-12 @5xl:grid-cols-1 @5xl:gap-0 @5xl:divide-y">
          <RunnerQueueRunWho run={run} className="@5xl:pb-3" />
          <div className="grid gap-4 @5xl:gap-0 @5xl:divide-y">
            <RunnerQueueRunWhen run={run} className="@5xl:py-3" />
            <RunnerQueueRunCost run={run} className="@5xl:pt-3" />
          </div>
        </div>
      )}
    </aside>
  );
}
