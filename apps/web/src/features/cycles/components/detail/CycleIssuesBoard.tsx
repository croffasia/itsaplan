'use client';

import { useMemo, useRef } from 'react';
import type { Cycle } from '@/lib/api/endpoints/cycles';
import { useShell } from '@/context/shellContext';
import { applyFilters } from '@/utils/filters';
import { defaultsFromFilters } from '@/utils/project';
import { useInitiativeOptionsQuery } from '@/services/initiatives.service';
import { countIssuesByColumn } from '@/features/work-items/utils/wipLimit';
import { useLocalBoardSettings } from '@/hooks/useLocalBoardSettings';
import FilterBar from '@/components/layout/FilterBar';
import DisplayPopover from '@/components/layout/DisplayPopover';
import BoardLayout from '@/features/work-items/components/BoardLayout';

// Where this board's layout and display settings are kept, per cycle.
const CYCLE_BOARD_STORE_KEY = 'planner_cycle_board_settings';

// The cycle's issues rendered as the work items board (kanban/table/timeline/
// calendar) with filters and display settings, but no saved views. The board is fed
// a project whose issues are just this cycle's, so drag/edit still hit the real
// issues and the live board refresh keeps it current. On a finished cycle a new
// issue is created without one: nothing is planned into a cycle that has ended.
export default function CycleIssuesBoard({ cycle }: { cycle: Cycle }) {
  const { project, customFields, onOpenIssue, onAddIssue, boardStatus } = useShell();
  const filterRef = useRef<HTMLDivElement>(null);
  const cycleId = cycle.id;
  const board = useLocalBoardSettings(CYCLE_BOARD_STORE_KEY, cycleId);
  const initiativeOptions = useInitiativeOptionsQuery(project?.project.key ?? null).data ?? [];
  const scopedIssues = useMemo(
    () => project?.issues.filter((issue) => issue.cycle?.id === cycleId) ?? [],
    [project?.issues, cycleId],
  );

  const viewProject = useMemo(() => {
    if (!project) return null;
    return { ...project, issues: applyFilters(scopedIssues, board.filters, project) };
  }, [project, scopedIssues, board.filters]);

  if (!project || !viewProject) return null;

  const viewProps = {
    project: viewProject,
    searchSource: { ...boardStatus, issues: viewProject.issues, unfilteredIssues: scopedIssues },
    onViewFilters: () => filterRef.current?.focus(),
    filters: board.filters,
    // Counted across the whole project, not just this cycle: the limit belongs to
    // the column, and its other issues occupy it just the same.
    columnCounts: countIssuesByColumn(project.issues),
    customFields,
    settings: board.settings,
    onSettingsChange: board.changeSettings,
    onOpenIssue,
    onAddIssue: (defaults: Parameters<typeof onAddIssue>[0]) =>
      onAddIssue({
        ...defaultsFromFilters(board.filters, {
          cycles: project.plannedCycles,
          initiatives: initiativeOptions,
        }),
        ...(cycle.status === 'completed' ? defaults : { cycleId, ...defaults }),
      }),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={filterRef}
        tabIndex={-1}
        className="flex items-center justify-between gap-2 border-b px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <FilterBar
          filters={board.filters}
          onChange={board.setFilters}
          project={project}
          customFields={customFields}
        />
        <DisplayPopover
          view={board.view}
          onViewChange={board.changeView}
          settings={board.settings}
          onSettingsChange={board.changeSettings}
          customFields={customFields}
          issueTypes={project.issueTypes}
        />
      </div>
      <div className="relative flex-1 overflow-hidden">
        <BoardLayout
          {...viewProps}
          view={board.view}
          widthScope="cycles"
          allIssues={project.issues}
        />
      </div>
    </div>
  );
}
