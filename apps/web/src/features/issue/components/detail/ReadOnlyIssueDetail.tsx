import { type SharedIssueBundle } from '@/lib/api';
import { toPublicProjectDetail } from '@/utils/publicProject';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import IssueCustomFieldBody from '../fields/IssueCustomFieldBody';
import IssueProperties from './IssueProperties';
import ReadOnlyActivityFeed from './ReadOnlyActivityFeed';

const noop = () => {};

// The full read-only body of a shared issue: title, description, markdown custom
// fields, the Properties grid and the activity feed. Reuses the authenticated
// detail components in read-only mode (no editing, no composer, no actions), fed
// from a self-contained public bundle. Used by the shared-issue page and, in the
// 'panel' layout, by a card opened from a shared board.
export default function ReadOnlyIssueDetail({
  bundle,
  layout = 'page',
}: {
  bundle: SharedIssueBundle;
  // 'page' puts the Properties in a right column; 'panel' stacks everything.
  layout?: 'page' | 'panel';
}) {
  const { project: scaffold, issue, feed } = bundle;
  const project = toPublicProjectDetail(scaffold);
  const imageByUserId = new Map(scaffold.assignees.map((a) => [a.userId, a.image]));

  // Custom fields applicable to this issue's type (global + type-scoped), matching
  // the authenticated detail. Fields flagged "show in main info" render in the body;
  // the rest render inside the Properties grid.
  const fieldDefs = scaffold.customFields.filter(
    (f) => f.issueTypeId == null || f.issueTypeId === issue.typeId,
  );

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

  const properties = (
    <IssueProperties
      project={project}
      issue={issue}
      fieldDefs={fieldDefs}
      onPatch={noop}
      onSetField={noop}
      onToggleLabel={noop}
      hasSidebar
      readOnly
    />
  );

  const activity = <ReadOnlyActivityFeed feed={feed} imageByUserId={imageByUserId} />;

  if (layout === 'panel') {
    return (
      <div>
        {body}
        <div className="mt-6">{properties}</div>
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
        {activity}
      </div>
      <aside className="w-[340px] shrink-0">{properties}</aside>
    </div>
  );
}
