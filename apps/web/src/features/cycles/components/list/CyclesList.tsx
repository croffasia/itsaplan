'use client';

import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import type { CyclesView } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import type { CompletedCycles } from '../../hooks/useCompletedCycles';
import CyclesTable from './CyclesTable';
import CyclesTimeline from './CyclesTimeline';

// The cycles of a project in the layout the user picked: a grouped table or a day
// track. `cycles` is what is still planned — active and upcoming. The finished ones
// are the table's archive; the timeline draws only what is ahead, but still takes
// them, since a dragged cycle may not run into one either.
export default function CyclesList({
  cycles,
  completed,
  projectKey,
  view,
  isLoading,
  canCreate,
  onCreate,
}: {
  cycles: Cycle[];
  completed: CompletedCycles;
  projectKey: string;
  view: CyclesView;
  isLoading: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const t = useTranslations('cycles');

  if (isLoading) return <ListSkeleton className="px-4 py-6" rowClassName="h-12" />;

  const newCycleButton = canCreate && (
    <Button size="sm" onClick={onCreate}>
      {t('newCycle')}
    </Button>
  );

  if (cycles.length === 0 && completed.total === 0) {
    return (
      <EmptyState title={t('emptyTitle')} description={t('emptyDescription')}>
        {newCycleButton}
      </EmptyState>
    );
  }

  if (view === 'table') {
    return <CyclesTable cycles={cycles} completed={completed} projectKey={projectKey} />;
  }

  if (cycles.length === 0) {
    return (
      <EmptyState title={t('nothingPlannedTitle')} description={t('nothingPlannedDescription')}>
        {newCycleButton}
      </EmptyState>
    );
  }

  return <CyclesTimeline cycles={cycles} finished={completed.items} projectKey={projectKey} />;
}
