'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useGroupLabels } from '@/hooks/useGroupLabels';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { revScope } from '@/utils/revScopes';
import { qk } from '@/services/queryKeys';
import { buildGroups, groupIssues } from '@/utils/project';
import { countIssuesByColumn } from './utils/wipLimit';
import {
  restoreHiddenSections,
  withoutHiddenSections,
  type ViewSettings,
} from '@/utils/viewSettings';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ViewTabs from '@/components/layout/ViewTabs';
import ViewIconPicker from '@/components/layout/ViewIconPicker';
import FilterBar from '@/components/layout/FilterBar';
import DisplayPopover from '@/components/layout/DisplayPopover';
import { IssueLinksProvider } from './context/useIssueLinks';
import { SubtasksProvider } from './context/useSubtasks';
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
  const t = useTranslations('workItems');
  const tCommon = useTranslations('common');
  const { project, filteredProject, views, editor, customFields, onOpenIssue, onAddIssue } =
    useShell();
  const { can } = usePermissions();
  const groupLabels = useGroupLabels();
  const features = useProjectFeatures();
  const [timelineCollapseState, setTimelineCollapseState] = useState<TimelineCollapseState>({
    scope: '',
    groups: new Set(),
  });

  // Live board: refetch the issues when anything on the board changes, so another
  // user's create/move/edit shows without a manual reload.
  const projectKey = project?.project.key ?? '';
  useLiveRefresh({
    scope: project ? revScope.board(project.project.id) : null,
    targets: [qk.boardIssues(projectKey)],
  });

  if (!project || !filteredProject) return null;

  // Saving persists the view: editing an existing one is a views edit, a brand-new
  // one is a views create. Filtering/display stay available to everyone (transient,
  // client-side); only persisting is gated.
  const canSaveView = can('views', editor.activeView ? 'edit' : 'create');

  // With an optional section off, its property and grouping are left out of what
  // the layouts and the Display panel work with, and put back on the way out so the
  // stored display keeps them for when the section is on again.
  const settings = withoutHiddenSections(editor.settings, features);
  const changeSettings = (next: ViewSettings) =>
    editor.changeSettings(restoreHiddenSections(next, editor.settings, features));

  // From the unfiltered project, so a column's WIP limit is measured against every
  // issue in it rather than the ones the active filters leave on screen.
  const columnCounts = countIssuesByColumn(project.issues);

  const timelineGroups = buildGroups(
    filteredProject,
    settings.group,
    groupLabels,
    editor.effectiveFilters,
  );
  const timelineIssuesByGroup = groupIssues(timelineGroups, filteredProject.issues, settings.group);
  const visibleTimelineGroupKeys = timelineGroups
    .filter(
      (group) =>
        settings.showEmptyGroups || (timelineIssuesByGroup.get(group.key)?.length ?? 0) > 0,
    )
    .map((group) => group.key);
  const timelineCollapseScope = [
    projectKey,
    editor.activeViewId ?? 'all',
    settings.group,
    settings.subgroup,
    settings.showEmptyGroups,
    settings.timelineCollapseAll,
  ].join(':');
  const initialTimelineCollapsedGroups = settings.timelineCollapseAll
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
    filters: editor.effectiveFilters,
    columnCounts,
    customFields,
    settings,
    onSettingsChange: changeSettings,
    onOpenIssue,
    onAddIssue,
  };

  function renderView() {
    switch (editor.view) {
      case 'table':
        return (
          <TableView
            {...viewProps}
            widthScope={editor.activeViewId ? `view:${editor.activeViewId}` : 'all'}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            {...viewProps}
            collapsedGroups={collapsedTimelineGroups}
            onToggleGroup={toggleTimelineGroup}
            viewId={editor.activeViewId}
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
    settings,
    onSettingsChange: changeSettings,
    customFields,
    issueTypes: project.issueTypes,
  };

  return (
    <>
      <ViewTabs
        views={views}
        projectKey={project.project.key}
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
                placeholder={t('viewNamePlaceholder')}
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
                {tCommon('cancel')}
              </Button>
              {canSaveView && (
                <Button
                  size="sm"
                  disabled={!editor.activeView && !editor.draftName.trim()}
                  onClick={() => void editor.saveEdits()}
                >
                  {tCommon('save')}
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

      <div className="relative flex-1 overflow-hidden">
        <IssueLinksProvider issues={project.issues} enabled={settings.showLinks}>
          <SubtasksProvider issues={project.issues} enabled={settings.showSubtasks}>
            {renderView()}
          </SubtasksProvider>
        </IssueLinksProvider>
      </div>
    </>
  );
}
