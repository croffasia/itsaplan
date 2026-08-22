import type { BoardIssue } from '@/lib/api';
import type { WorkItemsViewProps } from '@/utils/project';
import type { WorkItemsView } from '@/utils/viewTypes';
import { withoutShownSubtasks } from '@/utils/subtasks';
import { IssueLinksProvider } from '../context/useIssueLinks';
import { SubtasksProvider } from '../context/useSubtasks';
import KanbanBoard from './kanban/KanbanBoard';
import TableView from './table/TableView';
import TimelineView from './timeline/TimelineView';
import CalendarView from './calendar/CalendarView';

interface BoardLayoutProps extends WorkItemsViewProps {
  view: WorkItemsView;
  widthScope: string;
  // The project's whole issue list, not just the scoped and filtered ones in
  // `project`: the link and subtask rows read it so a card shows every link and
  // subtask it has, wherever the other end sits.
  allIssues: BoardIssue[];
}

// The board in its selected layout, with the relations and subtasks its cards and
// rows read. Used by the cycle and initiative boards and by the public share; the
// work items page composes the layouts itself, since its timeline carries the
// saved view's collapse state.
export default function BoardLayout({
  view,
  widthScope,
  allIssues,
  ...viewProps
}: BoardLayoutProps) {
  const { project, settings } = viewProps;
  const subtasksEnabled = project.project.subtasksEnabled;

  // Subtasks are rendered under their parent, so they are left out of the layouts'
  // own rows — unless the display asks for them separately, or the Subtasks section
  // is off and nothing renders the hierarchy.
  const hideSubtaskRows = subtasksEnabled && !settings.separateSubtasks;
  const layoutProps: WorkItemsViewProps = hideSubtaskRows
    ? { ...viewProps, project: { ...project, issues: withoutShownSubtasks(project.issues) } }
    : viewProps;

  function renderLayout() {
    switch (view) {
      case 'table':
        return <TableView {...layoutProps} widthScope={widthScope} />;
      case 'timeline':
        return <TimelineView {...layoutProps} />;
      case 'calendar':
        return <CalendarView {...layoutProps} />;
      default:
        return <KanbanBoard {...layoutProps} />;
    }
  }

  return (
    <IssueLinksProvider issues={allIssues} enabled={settings.showLinks}>
      <SubtasksProvider issues={allIssues} enabled={subtasksEnabled && settings.showSubtasks}>
        {renderLayout()}
      </SubtasksProvider>
    </IssueLinksProvider>
  );
}
