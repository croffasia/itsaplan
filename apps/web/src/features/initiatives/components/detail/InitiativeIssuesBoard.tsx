'use client';

import { useMemo } from 'react';
import { useShell } from '@/context/shellContext';
import { applyFilters, resolveFilterSet } from '@/utils/filters';
import { defaultsFromFilters } from '@/utils/project';
import { useInitiativeOptionsQuery } from '@/services/initiatives.service';
import { countIssuesByColumn } from '@/features/work-items/utils/wipLimit';
import FilterBar from '@/components/layout/FilterBar';
import DisplayPopover from '@/components/layout/DisplayPopover';
import BoardLayout from '@/features/work-items/components/BoardLayout';
import { useLocalBoardSettings } from '@/hooks/useLocalBoardSettings';

// Where this board's layout and display settings are kept, per initiative.
const INITIATIVE_BOARD_STORE_KEY = 'planner_initiative_board_settings';

// The initiative's issues rendered as the work items board (kanban/table/timeline/
// calendar) with filters and display settings, but no saved views. The board is
// fed a project whose issues are just this initiative's, so drag/edit still hit the
// real issues and the live board refresh keeps it current.
export default function InitiativeIssuesBoard({ initiativeId }: { initiativeId: number }) {
  const { project, customFields, filterContext, onOpenIssue, onAddIssue } = useShell();
  const board = useLocalBoardSettings(INITIATIVE_BOARD_STORE_KEY, initiativeId);
  const initiativeOptions = useInitiativeOptionsQuery(project?.project.key ?? null).data ?? [];
  const resolvedFilters = useMemo(
    () => resolveFilterSet(board.filters, filterContext),
    [board.filters, filterContext],
  );

  const viewProject = useMemo(() => {
    if (!project) return null;
    const issues = project.issues.filter((i) => i.initiative?.id === initiativeId);
    return { ...project, issues: applyFilters(issues, resolvedFilters, project, filterContext) };
  }, [project, initiativeId, resolvedFilters, filterContext]);

  if (!project || !viewProject) return null;

  const viewProps = {
    project: viewProject,
    filters: resolvedFilters,
    // Counted across the whole project, not just this initiative: the limit belongs
    // to the column, and its other issues occupy it just the same.
    columnCounts: countIssuesByColumn(project.issues),
    customFields,
    settings: board.settings,
    onSettingsChange: board.changeSettings,
    onOpenIssue,
    onAddIssue: (defaults: Parameters<typeof onAddIssue>[0]) =>
      onAddIssue({
        ...defaultsFromFilters(resolvedFilters, {
          cycles: project.plannedCycles,
          initiatives: initiativeOptions,
        }),
        initiativeId,
        ...defaults,
      }),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
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
          widthScope="initiatives"
          allIssues={project.issues}
        />
      </div>
    </div>
  );
}
