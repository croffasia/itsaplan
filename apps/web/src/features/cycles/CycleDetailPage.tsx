'use client';

import { useShell } from '@/context/shellContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useCycleQuery } from '@/services/cycles.service';
import CycleHeader from './components/detail/CycleHeader';
import CycleIssuesBoard from './components/detail/CycleIssuesBoard';

// One cycle: its header over the board of the issues planned into it.
export default function CycleDetailPage({ cycleId }: { cycleId: number }) {
  const { project } = useShell();
  const projectKey = project?.project.key ?? null;
  const cycle = useCycleQuery(cycleId).data;

  if (!project || !projectKey) return null;
  if (!cycle) return <Skeleton className="m-6 h-8 w-64" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CycleHeader cycle={cycle} projectKey={projectKey} />
      <CycleIssuesBoard cycleId={cycle.id} />
    </div>
  );
}
