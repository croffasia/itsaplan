'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { api, type BoardIssues } from '@/lib/api';
import { qk } from '@/services/queryKeys';
import { buildGroups, groupIssues } from '@/utils/project';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ViewTabs from '@/components/layout/ViewTabs';
import ViewIconPicker from '@/components/layout/ViewIconPicker';
import FilterBar from '@/components/layout/FilterBar';
import DisplayPopover from '@/components/layout/DisplayPopover';
import KanbanBoard from './components/kanban/KanbanBoard';
import TableView from './components/table/TableView';
import TimelineView from './components/timeline/TimelineView';
import CalendarView from './components/calendar/CalendarView';

interface TimelineCollapseState {
  scope: string;
  groups: Set<string>;
}

// The work items page (the index and /view/:viewId child routes of the Shell).
// It renders the saved-view tabs, the inline edit bar and the selected layout;
// the project data and the view editor come from the Shell through React context.
export default function WorkItemsPage() {
  const { project, filteredProject, views, editor, customFields, onOpenIssue, onAddIssue } =
    useShell();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [timelineCollapseState, setTimelineCollapseState] = useState<TimelineCollapseState>({
    scope: '',
    groups: new Set(),
  });

  // Live board: poll the board issues' change marker and refetch them when it
  // moves, so another user's create/move/edit shows without a manual reload. On
  // mount the first marker is compared against the cached issues' own marker, so
  // entering the section with a stale cache refetches at once.
  const projectKey = project?.project.key ?? '';
  useLiveRefresh({
    revKey: ['rev', 'boardIssues', projectKey],
    fetchRev: () => api.getBoardIssuesRev(projectKey),
    targets: [qk.boardIssues(projectKey)],
    intervalMs: 12000,
    enabled: !!projectKey,
    getCachedRev: () => qc.getQueryData<BoardIssues>(qk.boardIssues(projectKey))?.rev ?? null,
  });

  if (!project || !filteredProject) return null;

  // Saving persists the view: editing an existing one is a views edit, a brand-new
  // one is a views create. Filtering/display stay available to everyone (transient,
  // client-side); only persisting is gated.
  const canSaveView = can('views', editor.activeView ? 'edit' : 'create');
  const timelineGroups = buildGroups(filteredProject, editor.settings.group);
  const timelineIssuesByGroup = groupIssues(
    timelineGroups,
    filteredProject.issues,
    editor.settings.group,
  );
  const visibleTimelineGroupKeys = timelineGroups
    .filter(
      (group) =>
        editor.settings.showEmptyGroups || (timelineIssuesByGroup.get(group.key)?.length ?? 0) > 0,
    )
    .map((group) => group.key);
  const timelineCollapseScope = [
    projectKey,
    editor.activeViewId ?? 'all',
    editor.settings.group,
    editor.settings.showEmptyGroups,
    editor.settings.timelineCollapseAll,
  ].join(':');
  const initialTimelineCollapsedGroups = editor.settings.timelineCollapseAll
    ? new Set(visibleTimelineGroupKeys)
    : new Set<string>();
  const collapsedTimelineGroups =
    timelineCollapseState.scope === timelineCollapseScope
      ? timelineCollapseState.groups
      : initialTimelineCollapsedGroups;

  const toggleTimelineGroup = (groupKey: string) => {
    setTimelineCollapseState((current) => {
      const groups = new Set(
        current.scope === timelineCollapseScope ? current.groups : initialTimelineCollapsedGroups,
      );
      if (groups.has(groupKey)) groups.delete(groupKey);
      else groups.add(groupKey);
      return { scope: timelineCollapseScope, groups };
    });
  };

  const viewProps = {
    project: filteredProject,
    customFields,
    settings: editor.settings,
    onSettingsChange: editor.changeSettings,
    onOpenIssue,
    onAddIssue,
  };

  function renderView() {
    switch (editor.view) {
      case 'table':
        return <TableView {...viewProps} />;
      case 'timeline':
        return (
          <TimelineView
            {...viewProps}
            collapsedGroups={collapsedTimelineGroups}
            onToggleGroup={toggleTimelineGroup}
          />
        );
      case 'calendar':
        return <CalendarView {...viewProps} />;
      default:
        return <KanbanBoard {...viewProps} />;
    }
  }

  const displayProps = {
    view: editor.view,
    onViewChange: editor.changeView,
    settings: editor.settings,
    onSettingsChange: editor.changeSettings,
    customFields,
    issueTypes: project.issueTypes,
  };

  return (
    <>
      <ViewTabs
        views={views}
        activeViewId={editor.activeViewId}
        onSelect={editor.selectView}
        onNewView={editor.beginNewView}
        onEdit={editor.beginEditView}
        onDelete={(v) => void editor.deleteView(v)}
        onReorder={editor.reorderView}
        onToggleFilter={editor.toggleFilters}
        displayControl={<DisplayPopover {...displayProps} />}
      />

      {/* The filter row applies to the current screen only; it never writes to a
          view. The edit bar above it (icon picker + name input + Cancel/Save)
          appears only after Edit view or New view, and Save is the one write:
          it updates the active view or creates one from the live state. */}
      {(editor.editing || editor.showFilters) && (
        <div className="border-b">
          {editor.editing && (
            <div className="flex items-center gap-2 px-3 py-2">
              <ViewIconPicker icon={editor.draftIcon} onChange={editor.setDraftIcon} />
              <Input
                value={editor.draftName}
                placeholder="All issues"
                autoFocus
                onChange={(e) => editor.setDraftName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  (editor.activeView || editor.draftName.trim()) &&
                  void editor.saveEdits()
                }
                className="h-8 flex-1 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
              />
              <Button variant="ghost" size="sm" onClick={editor.cancelEdits}>
                Cancel
              </Button>
              {canSaveView && (
                <Button
                  size="sm"
                  disabled={!editor.activeView && !editor.draftName.trim()}
                  onClick={() => void editor.saveEdits()}
                >
                  Save
                </Button>
              )}
            </div>
          )}
          <div className={cn('px-3 pb-2', editor.editing ? '' : 'pt-2')}>
            <FilterBar
              filters={editor.filters}
              onChange={editor.changeFilters}
              project={project}
              customFields={customFields}
            />
          </div>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">{renderView()}</div>
    </>
  );
}
