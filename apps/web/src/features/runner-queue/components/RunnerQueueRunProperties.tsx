import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { usePersistedOpen, usePersistedOpenGroups } from '@/hooks/usePersistedOpen';
import IssuePropertyGroupHeading from '@/features/issue/components/detail/IssuePropertyGroupHeading';
import { useRunFacts } from '../hooks/useRunFacts';
import { useRunOriginFacts } from '../hooks/useRunOriginFacts';
import { useRunTimeFacts } from '../hooks/useRunTimeFacts';
import { useRunUsageFacts } from '../hooks/useRunUsageFacts';
import RunnerQueueRunFactList from './RunnerQueueRunFactList';

// The run's properties in groups. The section and each group fold as an issue's properties
// do, and the folds are remembered.
export default function RunnerQueueRunProperties({
  run,
  listPath,
}: {
  run: RunnerQueueRun;
  listPath: string;
}) {
  const t = useTranslations('issue.agentRuns');
  const details = usePersistedOpen('agent-run-details-open');
  const groupsOpen = usePersistedOpenGroups('agent-run-groups-closed');
  const groups = [
    { key: 'groupRun', facts: useRunFacts(run) },
    { key: 'groupOrigin', facts: useRunOriginFacts(run, listPath) },
    { key: 'groupTime', facts: useRunTimeFacts(run) },
    { key: 'groupUsage', facts: useRunUsageFacts(run) },
  ] as const;
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
        <div className="mt-3 grid items-start gap-x-12 gap-y-5 @xl:grid-cols-2 @5xl:grid-cols-1">
          {groups
            .filter((group) => group.facts.length > 0)
            .map((group) => {
              const open = groupsOpen.isOpen(group.key);
              return (
                <section key={group.key}>
                  <IssuePropertyGroupHeading
                    label={t(group.key)}
                    open={open}
                    onToggle={() => groupsOpen.toggle(group.key)}
                    className="w-full"
                  />
                  {open && <RunnerQueueRunFactList facts={group.facts} className="mt-3" />}
                </section>
              );
            })}
        </div>
      )}
    </aside>
  );
}
