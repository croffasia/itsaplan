'use client';

import { useMemo } from 'react';
import type { ProjectDetail, StateType } from '@/lib/api';

// The initiative's linked issues counted per state group. Complements the header
// progress pill with the full distribution (backlog through canceled).

// Colors are fixed per group rather than taken from the columns, because a group
// spans several columns with their own colors.
const GROUPS: { type: StateType; label: string; color: string }[] = [
  { type: 'backlog', label: 'Backlog', color: '#a1a1aa' },
  { type: 'unstarted', label: 'Todo', color: '#64748b' },
  { type: 'started', label: 'In Progress', color: '#eab308' },
  { type: 'completed', label: 'Done', color: '#22c55e' },
  { type: 'canceled', label: 'Canceled', color: '#ef4444' },
];

export default function InitiativeStateBreakdown({
  project,
  initiativeId,
}: {
  project: ProjectDetail;
  initiativeId: number;
}) {
  const counts = useMemo(() => {
    const stateByColumn = new Map(project.columns.map((c) => [c.id, c.stateType]));
    const acc: Record<StateType, number> = {
      backlog: 0,
      unstarted: 0,
      started: 0,
      completed: 0,
      canceled: 0,
    };
    for (const issue of project.issues) {
      if (issue.initiative?.id !== initiativeId) continue;
      const type = stateByColumn.get(issue.columnId);
      if (type) acc[type] += 1;
    }
    return acc;
  }, [project.columns, project.issues, initiativeId]);

  const total = GROUPS.reduce((sum, g) => sum + counts[g.type], 0);

  return (
    <div>
      <h4 className="mb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Progress
      </h4>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No issues linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {GROUPS.map((g) => (
            <li key={g.type} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: g.color }}
              />
              <span className="text-muted-foreground">{g.label}</span>
              <span className="ml-auto text-foreground tabular-nums">{counts[g.type]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
