import { type SharedViewBundle } from '@/lib/api';
import { defaultViewSettings } from '@/utils/viewSettings';
import { EMPTY_FILTER_SET } from '@/utils/filters';
import { type WorkItemsViewProps } from '@/utils/project';
import { toPublicProjectDetail } from '@/utils/publicProject';
import PublicShareHeader from '@/components/common/page/PublicShareHeader';
import BoardLayout from '../BoardLayout';

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

  const viewProps: WorkItemsViewProps = {
    project,
    // The view's filters stay on the server, which sends only the issues they
    // match: a link that hides labels and custom field values does not carry
    // enough to re-run them here.
    filters: EMPTY_FILTER_SET,
    // No real column totals to measure a limit against for the same reason, and a
    // share has nothing to drop anyway: empty leaves the counters plain.
    columnCounts: new Map(),
    customFields: project.customFields,
    settings,
    onSettingsChange: noop,
    onOpenIssue,
    onAddIssue: noop,
    readOnly: true,
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PublicShareHeader
        name={project.project.name}
        ticker={project.project.key}
        trailing={bundle.view.name}
      />
      <div className="relative min-h-0 flex-1">
        <BoardLayout {...viewProps} view={layout} widthScope="all" allIssues={project.issues} />
      </div>
    </div>
  );
}
