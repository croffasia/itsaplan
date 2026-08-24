import { type SharedIssueBundle } from '@/lib/api';
import { toPublicProjectDetail } from '@/utils/publicProject';
import { usePersistedOpen, usePersistedOpenGroups } from '../../hooks/usePersistedOpen';
import { fieldDefsForType } from '../../utils/fieldDefs';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import IssueCustomFieldBody from '../fields/IssueCustomFieldBody';
import IssueProperties from './IssueProperties';
import IssueSubtasksPanel from './IssueSubtasksPanel';
import IssueLinksPanel from './IssueLinksPanel';
import ReadOnlyActivityFeed from './ReadOnlyActivityFeed';
import { useTranslations } from 'next-intl';

const noop = () => {};

// The full read-only body of a shared issue: title, description, markdown custom
// fields, the Properties grid, the subtask hierarchy, the relations and the
// activity feed. Reuses the authenticated detail components in read-only mode (no
// editing, no composer, no actions), fed from a self-contained public bundle. Used
// by the shared-issue page and by a card opened from a shared board.
export default function ReadOnlyIssueDetail({
  bundle,
  extended,
  onOpenIssue,
}: {
  bundle: SharedIssueBundle;
  // A link shared without the full issue carries no activity, so the page leaves
  // the section out rather than showing it empty.
  extended: boolean;
  // Opens another issue of the same share (a subtask, a parent, the other end of a
  // relation). A shared board passes it; a single shared issue has nowhere to go,
  // so its rows only name the issue.
  onOpenIssue?: (id: number) => void;
}) {
  const t = useTranslations('issue');
  const { project: scaffold, issue, feed } = bundle;
  const properties = usePersistedOpen('issue-properties-open');
  const propertyGroups = usePersistedOpenGroups('issue-property-groups-closed');
  const project = toPublicProjectDetail(scaffold);
  const imageByUserId = new Map(scaffold.assignees.map((a) => [a.userId, a.image]));

  const fieldDefs = fieldDefsForType(scaffold.customFields, issue.typeId);

  // Content on the left (capped), the Properties panel pinned to the right edge,
  // matching the standalone issue page.
  return (
    <div className="flex justify-between gap-8 px-8 py-8 xl:px-12">
      <div className="w-full max-w-3xl min-w-0">
        <div className="flex items-center gap-2">
          {issue.archivedAt && (
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
              {t('archived')}
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">{issue.identifier}</span>
        </div>
        <h1 className="mt-1 text-lg font-semibold">{issue.title}</h1>

        {issue.description.trim() && (
          <IssueMarkdownEditor className="mt-4" defaultValue={issue.description} editable={false} />
        )}

        {fieldDefs
          .filter((def) => def.showInBody)
          .map((def) => (
            <IssueCustomFieldBody
              key={def.id}
              def={def}
              current={issue.fields.find((f) => f.fieldId === def.id)}
              assignees={project.assignees}
              saveKey={`${def.id}-${issue.updatedAt}`}
              onSetField={noop}
              readOnly
            />
          ))}

        {scaffold.project.subtasksEnabled && (
          <IssueSubtasksPanel project={project} issue={issue} readOnly onOpenIssue={onOpenIssue} />
        )}
        <IssueLinksPanel project={project} issue={issue} readOnly onOpenIssue={onOpenIssue} />

        {extended && <ReadOnlyActivityFeed feed={feed} imageByUserId={imageByUserId} />}
      </div>

      <aside className="w-[340px] shrink-0">
        <IssueProperties
          project={project}
          issue={issue}
          fieldDefs={fieldDefs}
          onPatch={noop}
          onSetField={noop}
          onToggleLabel={noop}
          readOnly
          className="mt-0 border-t-0 pt-0"
          open={properties.open}
          onToggle={properties.toggle}
          groupsOpen={propertyGroups}
        />
      </aside>
    </div>
  );
}
