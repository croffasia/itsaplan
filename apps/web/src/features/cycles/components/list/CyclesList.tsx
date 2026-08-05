import type { Cycle } from '@/lib/api';
import { CYCLE_STATUS_META, CYCLE_STATUS_ORDER } from '@/utils/cycleMeta';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import CycleRow from './CycleRow';

// The project's cycles, one table per status: what is running, what is next, what is
// behind. A status with no cycles is left out.
export default function CyclesList({
  cycles,
  projectKey,
  isLoading,
  canCreate,
  onCreate,
}: {
  cycles: Cycle[];
  projectKey: string;
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

  return (
    <div className="flex flex-col gap-6 px-4 pb-6">
      {CYCLE_STATUS_ORDER.map((status) => {
        const group = cycles.filter((c) => c.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {CYCLE_STATUS_META[status].label}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3">Name</TableHead>
                  <TableHead className="px-3">Dates</TableHead>
                  <TableHead className="px-3">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.map((cycle) => (
                  <CycleRow key={cycle.id} cycle={cycle} projectKey={projectKey} />
                ))}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </div>
  );
}
