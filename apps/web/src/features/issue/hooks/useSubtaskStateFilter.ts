import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { IssueRef } from '@/lib/api/endpoints/issues';
import { usePersistedOpenGroups } from './usePersistedOpen';

// Which states the Subtasks panel hides, remembered per project. Only the states
// the subtasks are in are offered, each with how many subtasks it holds.
export function useSubtaskStateFilter(project: ProjectDetail, subtasks: IssueRef[]) {
  const shown = usePersistedOpenGroups(`issue-subtasks-hidden-states:${project.project.id}`);

  const columns = project.columns
    .map((column) => ({
      column,
      count: subtasks.filter((s) => s.columnId === column.id).length,
    }))
    .filter((entry) => entry.count > 0);

  return {
    columns,
    hidden: columns.filter(({ column }) => !shown.isOpen(String(column.id))).map((e) => e.column),
    shownSubtasks: subtasks.filter((s) => shown.isOpen(String(s.columnId))),
    isShown: (columnId: number) => shown.isOpen(String(columnId)),
    toggle: (columnId: number) => shown.toggle(String(columnId)),
    showAll: shown.openAll,
  };
}

export type SubtaskStateFilter = ReturnType<typeof useSubtaskStateFilter>;
