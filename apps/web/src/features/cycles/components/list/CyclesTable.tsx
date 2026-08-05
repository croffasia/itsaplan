import { Fragment } from 'react';
import type { Cycle } from '@/lib/api';
import { usePersistedSet } from '@/hooks/usePersistedSet';
import { groupCycles } from '../../utils/cycleGroups';
import CycleTableSection from './CycleTableSection';
import CycleTableRow from './CycleTableRow';

// The header row and every cycle row share this template, so the labels line up
// with the cells below them.
const GRID = 'minmax(200px,1fr) 200px 60px 56px 132px 32px';

// The project's cycles as one table, grouped by the status their dates put them in.
// Each group folds away, and which ones are folded is remembered per project.
export default function CyclesTable({
  cycles,
  projectKey,
}: {
  cycles: Cycle[];
  projectKey: string;
}) {
  const collapsed = usePersistedSet(`cycles-collapsed:${projectKey}`);

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[760px]">
        <div
          className="sticky top-0 z-10 grid items-center gap-3 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Name</span>
          <span>Dates</span>
          <span>Length</span>
          <span>Issues</span>
          <span>Progress</span>
          <span />
        </div>

        {groupCycles(cycles).map((group) => {
          const isCollapsed = collapsed.values.has(group.status);
          return (
            <Fragment key={group.status}>
              <CycleTableSection
                group={group}
                collapsed={isCollapsed}
                onToggle={() => collapsed.toggle(group.status)}
              />
              {!isCollapsed &&
                group.cycles.map((cycle) => (
                  <CycleTableRow
                    key={cycle.id}
                    cycle={cycle}
                    projectKey={projectKey}
                    gridTemplate={GRID}
                  />
                ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
