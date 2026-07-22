'use client';

import { useMemo } from 'react';
import { useShell } from '@/context/shellContext';
import { applyFilters } from '@/utils/filters';
import FilterBar from '@/components/layout/FilterBar';
import DisplayPopover from '@/components/layout/DisplayPopover';
import KanbanBoard from '@/features/work-items/components/kanban/KanbanBoard';
import TableView from '@/features/work-items/components/table/TableView';
import TimelineView from '@/features/work-items/components/timeline/TimelineView';
import CalendarView from '@/features/work-items/components/calendar/CalendarView';
import { useInitiativeBoardSettings } from '../../hooks/useInitiativeBoardSettings';

// The initiative's issues rendered as the work items board (kanban/table/timeline/
// calendar) with filters and display settings, but no saved views. The board is
// fed a project whose issues are just this initiative's, so drag/edit still hit the
// real issues and the live board refresh keeps it current.
export default function InitiativeIssuesBoard({ initiativeId }: { initiativeId: number }) {
  const { project, customFields, onOpenIssue, onAddIssue } = useShell();
  const board = useInitiativeBoardSettings(initiativeId);

  const viewProject = useMemo(() => {
    if (!project) return null;
    const issues = project.issues.filter((i) => i.initiative?.id === initiativeId);
    return { ...project, issues: applyFilters(issues, board.filters, project) };
  }, [project, initiativeId, board.filters]);

  if (!project || !viewProject) return null;

  const viewProps = {
    project: viewProject,
    customFields,
    settings: board.settings,
    onSettingsChange: board.changeSettings,
    onOpenIssue,
    onAddIssue: (defaults: Parameters<typeof onAddIssue>[0]) =>
      onAddIssue({ initiativeId, ...defaults }),
  };

  let view;
  switch (board.view) {
    case 'table':
      view = <TableView {...viewProps} />;
      break;
    case 'timeline':
      view = <TimelineView {...viewProps} />;
      break;
    case 'calendar':
      view = <CalendarView {...viewProps} />;
      break;
    default:
      view = <KanbanBoard {...viewProps} />;
  }

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
      <div className="relative flex-1 overflow-hidden">{view}</div>
    </div>
  );
}
