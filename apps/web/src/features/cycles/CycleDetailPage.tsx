'use client';

import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useCycleQuery } from '@/services/cycles.service';
import CycleHeader from './components/detail/CycleHeader';
import CycleIssuesBoard from './components/detail/CycleIssuesBoard';

// One cycle: its header over the board of the issues planned into it.
export default function CycleDetailPage({ cycleId }: { cycleId: number }) {
  const t = useTranslations('cycles');
  const { project } = useShell();
  const projectKey = project?.project.key ?? null;
  const query = useCycleQuery(cycleId);
  const cycle = query.data;

  if (!project || !projectKey) return null;
  if (!cycle)
    return query.isLoading ? (
      <Skeleton className="m-6 h-8 w-64" />
    ) : (
      <p className="px-6 py-8 text-sm text-muted-foreground">{t('notFound')}</p>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CycleHeader cycle={cycle} projectKey={projectKey} />
      <CycleIssuesBoard cycle={cycle} />
    </div>
  );
}
