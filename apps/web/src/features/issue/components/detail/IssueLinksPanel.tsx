import { useState } from 'react';
import { type IssueLinkInputKind, type IssueRelations, type ProjectDetail } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { LINK_RELATIONS, inverseRelation, linkRelation, storedKind } from '@/utils/issueLinks';
import { useLinkRelationLabel } from '@/hooks/useLinkRelationLabel';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import { useLinkIssues, useUnlinkIssues } from '../../services/links.service';
import NewIssueModal from '../create/NewIssueModal';
import IssueLinkDialog from './IssueLinkDialog';
import IssueLinksAddMenu from './IssueLinksAddMenu';
import IssueRefRow from './IssueRefRow';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

// The issue's relations to other issues, grouped by how each reads from this
// issue (Blocked by, Blocks, Duplicates, Duplicated by, Related). The links come
// with the issue, so the panel takes them rather than fetching them. A link is
// added either to an issue found through the search dialog or to one created on
// the spot in the ordinary create modal. The heading collapses the section, the
// same way the Stats one below it does; unlike Stats, which reads the account
// preferences, this is a client-only choice. On a public share the section lists
// the relations and nothing else, and stays off the page when there are none.
export default function IssueLinksPanel({
  project,
  issue,
  readOnly,
  onOpenIssue,
}: {
  project: ProjectDetail;
  issue: IssueRelations;
  readOnly?: boolean;
  // Where a public share opens the issue on the other end, which has no page of
  // its own to link to.
  onOpenIssue?: (id: number) => void;
}) {
  const t = useTranslations('issue.links');
  const relationLabel = useLinkRelationLabel();
  const { can } = usePermissions();
  const canEdit = !readOnly && can('work_items', 'edit');
  const canCreate = !readOnly && can('work_items', 'create');
  const [adding, setAdding] = useState<IssueLinkInputKind | null>(null);
  const [creating, setCreating] = useState<IssueLinkInputKind | null>(null);
  const { open, toggle } = usePersistedOpen('issue-links-open');
  const linkIssues = useLinkIssues();
  const unlinkIssues = useUnlinkIssues();

  const links = issue.links;
  if (readOnly && links.length === 0) return null;

  const groups = LINK_RELATIONS.map((relation) => ({
    relation,
    links: links.filter((link) => linkRelation(link) === relation),
  })).filter((group) => group.links.length > 0);

  return (
    // Collapsed, the heading row is all there is, so the section pulls itself up
    // against the Stats section below: the heading would otherwise sit off-centre
    // between its own padding above and that section's margin below.
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      {/* Fixed height: the Add button only renders while the section is open, and
          without it the row would shrink to the height of the heading text. */}
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading label={t('title')} open={open} onToggle={toggle} />
        {open && canEdit && (
          <IssueLinksAddMenu
            canCreate={canCreate}
            onLinkExisting={setAdding}
            onCreateNew={setCreating}
          />
        )}
      </div>

      {open &&
        (links.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t('emptyHint')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.relation}>
                <h4 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                  {relationLabel(group.relation)}
                </h4>
                {group.links.map((link) => (
                  <IssueRefRow
                    key={link.id}
                    project={project}
                    issue={link.issue}
                    scrollAnchorKey={`link:${link.id}`}
                    removeLabel={t('remove', { issue: link.issue.identifier })}
                    readOnly={readOnly}
                    onOpen={onOpenIssue && (() => onOpenIssue(link.issue.id))}
                    onRemove={
                      canEdit
                        ? () =>
                            unlinkIssues.mutate({
                              projectKey: project.project.key,
                              issueId: issue.id,
                              otherIssueId: link.issue.id,
                              linkId: link.id,
                            })
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        ))}

      {adding && (
        <IssueLinkDialog
          project={project}
          issueId={issue.id}
          relation={adding}
          linkedIssueIds={
            new Set(
              links.filter((link) => link.kind === storedKind(adding)).map((link) => link.issue.id),
            )
          }
          onClose={() => setAdding(null)}
        />
      )}

      {creating && (
        <NewIssueModal
          project={project}
          defaults={{
            typeId: issue.typeId,
            initiativeId: issue.initiative?.id ?? null,
            assigneeUserId: issue.assigneeUserId,
            delegateUserId: null,
            priority: issue.priority,
          }}
          // The crumb names the relation from the new issue's end, the way the
          // subtask one does; the menu picked it from this issue's end.
          crumb={`${relationLabel(inverseRelation(creating))} ${issue.identifier}`}
          onClose={() => setCreating(null)}
          onCreated={(created) => {
            linkIssues.mutate({
              projectKey: project.project.key,
              issueId: issue.id,
              otherIssueId: created.id,
              kind: creating,
            });
            setCreating(null);
          }}
        />
      )}
    </div>
  );
}
