import { type SharedIssueBundle } from '@/lib/api';
import { toPublicProjectDetail } from '@/utils/publicProject';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import { fieldDefsForType } from '../../utils/fieldDefs';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import IssueCustomFieldBody from '../fields/IssueCustomFieldBody';
import IssueProperties from './IssueProperties';
import IssueSubtasksPanel from './IssueSubtasksPanel';
import IssueLinksPanel from './IssueLinksPanel';
import ReadOnlyActivityFeed from './ReadOnlyActivityFeed';

const noop = () => {};

// The full read-only body of a shared issue: title, description, markdown custom
// fields, the Properties grid, the subtask hierarchy, the relations and the
// activity feed. Reuses the authenticated detail components in read-only mode (no
// editing, no composer, no actions), fed from a self-contained public bundle. Used
// by the shared-issue page and, in the 'panel' layout, by a card opened from a
// shared board.
export default function ReadOnlyIssueDetail({
  bundle,
  layout = 'page',
  extended,
  onOpenIssue,
}: {
  bundle: SharedIssueBundle;
  // 'page' puts the Properties in a right column; 'panel' stacks everything.
  layout?: 'page' | 'panel';
  // A link shared without the full issue carries no activity, so the page leaves
  // the section out rather than showing it empty.
  extended: boolean;
  // Opens another issue of the same share (a subtask, a parent, the other end of a
  // relation). A shared board passes it; a single shared issue has nowhere to go,
  // so its rows only name the issue.
  onOpenIssue?: (id: number) => void;
}) {
  const { project: scaffold, issue, feed } = bundle;
  const properties = usePersistedOpen('issue-properties-open');
  const project = toPublicProjectDetail(scaffold);
  const imageByUserId = new Map(scaffold.assignees.map((a) => [a.userId, a.image]));

  const fieldDefs = fieldDefsForType(scaffold.customFields, issue.typeId);

  const body = (
    <>
      <div className="flex items-center gap-2">
        {issue.archivedAt && (
          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
            Archived
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{issue.identifier}</span>
      </div>
      <h1 className="mt-1 text-lg font-semibold">{issue.title}</h1>

      {issue.description.trim() && (
        <IssueMarkdownEditor className="mt-2" defaultValue={issue.description} editable={false} />
      )}

      {fieldDefs
        .filter((def) => def.showInBody)
        .map((def) => (
          <IssueCustomFieldBody
            key={def.id}
            def={def}
            current={issue.fields.find((f) => f.fieldId === def.id)}
            saveKey={`${def.id}-${issue.updatedAt}`}
            onSetField={noop}
            readOnly
          />
        ))}
    </>
  );

  const renderProperties = (className?: string) => (
    <IssueProperties
      project={project}
      issue={issue}
      fieldDefs={fieldDefs}
      onPatch={noop}
      onSetField={noop}
      onToggleLabel={noop}
      readOnly
      className={className}
      open={properties.open}
      onToggle={properties.toggle}
    />
  );

  const relations = (
    <>
      <IssueSubtasksPanel project={project} issue={issue} readOnly onOpenIssue={onOpenIssue} />
      <IssueLinksPanel project={project} issue={issue} readOnly onOpenIssue={onOpenIssue} />
    </>
  );

  const activity = extended ? (
    <ReadOnlyActivityFeed feed={feed} imageByUserId={imageByUserId} />
  ) : null;

  if (layout === 'panel') {
    return (
      <div>
        {body}
        {renderProperties()}
        {relations}
        {activity}
      </div>
    );
  }

  // Full-width page layout matching the standalone issue page: content on the left
  // (capped), the Properties panel pinned to the right edge.
  return (
    <div className="flex justify-between gap-8 px-8 py-8 xl:px-12">
      <div className="w-full max-w-3xl min-w-0">
        {body}
        {relations}
        {activity}
      </div>
      {/* Nothing sits above it in this column, so the section drops the room and
          the separator it keeps for the block it follows in a single column. */}
      <aside className="w-[340px] shrink-0">{renderProperties('mt-0 border-t-0 pt-0')}</aside>
    </div>
  );
}
