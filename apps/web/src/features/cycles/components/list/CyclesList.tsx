import type { Cycle } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import type { CyclesView } from '../../hooks/useCyclesView';
import CyclesTable from './CyclesTable';
import CyclesTimeline from './CyclesTimeline';

// The cycles of a project in the layout the user picked: a grouped table or a day
// track. Both group by the status the dates put a cycle in.
export default function CyclesList({
  cycles,
  projectKey,
  view,
  isLoading,
  canCreate,
  onCreate,
}: {
  cycles: Cycle[];
  projectKey: string;
  view: CyclesView;
  isLoading: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  if (isLoading) return <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>;

  if (cycles.length === 0) {
    return (
      <EmptyState
        title="No cycles yet"
        description="A cycle is a time-boxed period the team plans its issues into."
      >
        {canCreate && (
          <Button size="sm" onClick={onCreate}>
            New cycle
          </Button>
        )}
      </EmptyState>
    );
  }

  return view === 'timeline' ? (
    <CyclesTimeline cycles={cycles} projectKey={projectKey} />
  ) : (
    <CyclesTable cycles={cycles} projectKey={projectKey} />
  );
}
