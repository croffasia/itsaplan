import { type SharedViewBundle } from '@/lib/api';
import { defaultViewSettings } from '@/utils/viewSettings';
import { EMPTY_FILTER_SET } from '@/utils/filters';
import { type WorkItemsViewProps } from '@/utils/project';
import { toPublicProjectDetail } from '@/utils/publicProject';
import { withoutShownSubtasks } from '@/utils/subtasks';
import PublicShareHeader from '@/components/common/page/PublicShareHeader';
import { IssueLinksProvider } from '../../context/useIssueLinks';
import { SubtasksProvider } from '../../context/useSubtasks';
import KanbanBoard from '../kanban/KanbanBoard';
import TableView from '../table/TableView';
import TimelineView from '../timeline/TimelineView';
import CalendarView from '../calendar/CalendarView';

const noop = () => {};

// Renders a shared saved view as a read-only board: the same layout components as
// the authenticated board, in the view's configured layout with its grouping and
// sorting applied. Every mutation affordance is off (readOnly); clicking an issue
// calls onOpenIssue.
export default function ReadOnlyBoard({
  bundle,
  onOpenIssue,
}: {
  bundle: SharedViewBundle;
  onOpenIssue: (id: number) => void;
}) {
  const project = toPublicProjectDetail(bundle.project, bundle.issues);
  const layout = bundle.view.display.layout ?? 'kanban';
  const { layout: _omit, ...displaySettings } = bundle.view.display;
  const settings = { ...defaultViewSettings(layout), ...displaySettings };

  // The server applied the view's filters: a link that hides labels and custom
  // field values does not carry enough to re-run them here. Subtasks are rendered
  // under their parent, so they are left out of the layouts' own rows — unless the
  // view asks for them separately, or the Subtasks section is off and nothing
  // renders the hierarchy.
  const subtasksEnabled = bundle.project.project.subtasksEnabled;
  const hideSubtaskRows = subtasksEnabled && !settings.separateSubtasks;
  const boardProject = {
    ...project,
    issues: hideSubtaskRows ? withoutShownSubtasks(project.issues) : project.issues,
  };

  const viewProps: WorkItemsViewProps = {
    project: boardProject,
    // The view's filters stay on the server, which sends only the issues they match.
    filters: EMPTY_FILTER_SET,
    customFields: project.customFields,
    settings,
    onSettingsChange: noop,
    onOpenIssue,
    onAddIssue: noop,
    readOnly: true,
  };

  function renderView() {
    switch (layout) {
      case 'table':
        return <TableView {...viewProps} widthScope="all" />;
      case 'timeline':
        return <TimelineView {...viewProps} />;
      case 'calendar':
        return <CalendarView {...viewProps} />;
      default:
        return <KanbanBoard {...viewProps} />;
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PublicShareHeader
        name={project.project.name}
        ticker={project.project.key}
        trailing={bundle.view.name}
      />
      <div className="relative min-h-0 flex-1">
        <IssueLinksProvider issues={project.issues} enabled={settings.showLinks}>
          <SubtasksProvider
            issues={project.issues}
            enabled={subtasksEnabled && settings.showSubtasks}
          >
            {renderView()}
          </SubtasksProvider>
        </IssueLinksProvider>
      </div>
    </div>
  );
}
