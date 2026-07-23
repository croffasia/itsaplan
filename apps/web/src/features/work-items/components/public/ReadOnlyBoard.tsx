import { type SharedViewBundle } from '@/lib/api';
import { applyFilters } from '@/utils/filters';
import { defaultViewSettings } from '@/utils/viewSettings';
import { type WorkItemsViewProps } from '@/utils/project';
import { toPublicProjectDetail } from '@/utils/publicProject';
import PublicShareHeader from '@/components/common/page/PublicShareHeader';
import KanbanBoard from '../kanban/KanbanBoard';
import TableView from '../table/TableView';
import TimelineView from '../timeline/TimelineView';
import CalendarView from '../calendar/CalendarView';

const noop = () => {};

// Renders a shared saved view as a read-only board: the same layout components as
// the authenticated board, in the view's configured layout with its filters,
// grouping and sorting applied. Every mutation affordance is off (readOnly);
// clicking an issue calls onOpenIssue.
export default function ReadOnlyBoard({
  bundle,
  onOpenIssue,
}: {
  bundle: SharedViewBundle;
  onOpenIssue: (id: number) => void;
}) {
  const project = toPublicProjectDetail(bundle.project, bundle.issues);
  const filteredProject = {
    ...project,
    issues: applyFilters(project.issues, bundle.view.filters, project),
  };

  const layout = bundle.view.display.layout ?? 'kanban';
  const { layout: _omit, ...displaySettings } = bundle.view.display;
  const settings = { ...defaultViewSettings(layout), ...displaySettings };

  const viewProps: WorkItemsViewProps = {
    project: filteredProject,
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
        return <TableView {...viewProps} />;
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
      <div className="relative min-h-0 flex-1">{renderView()}</div>
    </div>
  );
}
