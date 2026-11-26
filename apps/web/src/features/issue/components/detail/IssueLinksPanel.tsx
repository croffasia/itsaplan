import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { IssueLinkInputKind, IssueRelations } from '@/lib/api/endpoints/issues';
import { usePermissions } from '@/hooks/usePermissions';
import { LINK_RELATIONS, inverseRelation, linkRelation, storedKind } from '@/utils/issueLinks';
import { useLinkRelationLabel } from '@/hooks/useLinkRelationLabel';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { useLinkIssues, useUnlinkIssues } from '../../services/links.service';
import { useSetRelatedIssueState } from '../../services/relatedIssues.service';
import NewIssueModal from '../create/NewIssueModal';
import IssueLinkDialog from './IssueLinkDialog';
import IssueLinksAddMenu from './IssueLinksAddMenu';
import IssueRefRow from './IssueRefRow';
import IssueRefList from './IssueRefList';
import IssueSection from './IssueSection';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

// A relation being added from this issue's end: to an issue found through the search
// dialog, or to one created in the create modal.
export interface IssueLinkAdding {
  mode: 'link' | 'create';
  relation: IssueLinkInputKind;
}

// The issue's relations to other issues, grouped by how each reads from this
// issue (Blocked by, Blocks, Duplicates, Duplicated by, Related). The links come
// with the issue, so the panel takes them rather than fetching them. A link is
// added either to an issue found through the search dialog or to one created on
// the spot in the ordinary create modal. The heading collapses the section; unlike
// Stats, which reads the account preferences, this is a client-only choice. The
// section stays off the page while there are no relations; the issue's add bar
// starts the first one.
export default function IssueLinksPanel({
  project,
  issue,
  adding = null,
  onAddingChange,
  readOnly,
  onOpenIssue,
}: {
  project: ProjectDetail;
  issue: IssueRelations;
  // The dialog that is open: the search for an issue to link, or the create modal,
  // with the relation picked in the menu. Held by the issue detail, whose add bar
  // opens them too. A public share adds nothing.
  adding?: IssueLinkAdding | null;
  onAddingChange?: (adding: IssueLinkAdding | null) => void;
  readOnly?: boolean;
  // Where a public share opens the issue on the other end, which has no page of
  // its own to link to.
  onOpenIssue?: (id: number) => void;
}) {
  const tCommon = useTranslations('common');
  const t = useTranslations('issue.links');
  const relationLabel = useLinkRelationLabel();
  const { can } = usePermissions();
  const canEdit = !readOnly && can('work_items', 'edit');
  const canCreate = !readOnly && can('work_items', 'create');
  const { open, toggle } = usePersistedOpen('issue-links-open');
  const linkIssues = useLinkIssues();
  const unlinkIssues = useUnlinkIssues();
  const setState = useSetRelatedIssueState(project.project.ref, issue.id);

  const links = issue.links;
  const close = () => onAddingChange?.(null);

  const groups = LINK_RELATIONS.map((relation) => ({
    relation,
    links: links.filter((link) => linkRelation(link) === relation),
  })).filter((group) => group.links.length > 0);

  const dialogs = (
    <>
      {adding?.mode === 'link' && (
        <IssueLinkDialog
          project={project}
          issueId={issue.id}
          relation={adding.relation}
          linkedIssueIds={
            new Set(
              links
                .filter((link) => link.kind === storedKind(adding.relation))
                .map((link) => link.issue.id),
            )
          }
          onClose={close}
        />
      )}

      {adding?.mode === 'create' && (
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
          crumb={`${relationLabel(inverseRelation(adding.relation))} ${issue.identifier}`}
          onClose={close}
          onCreated={(created) => {
            linkIssues.mutate({
              projectKey: project.project.ref,
              issueId: issue.id,
              otherIssueId: created.id,
              kind: adding.relation,
            });
            close();
          }}
        />
      )}
    </>
  );

  if (links.length === 0) return dialogs;

  return (
    <IssueSection collapsed={!open}>
      <IssueSectionHeading
        label={t('title')}
        open={open}
        onToggle={toggle}
        actions={
          open &&
          canEdit && (
            <IssueLinksAddMenu
              canCreate={canCreate}
              onLinkExisting={(relation) => onAddingChange?.({ mode: 'link', relation })}
              onCreateNew={(relation) => onAddingChange?.({ mode: 'create', relation })}
              trigger={<IssueSectionAddButton label={tCommon('add')} />}
            />
          )
        }
      />

      {open && (
        <IssueRefList className="gap-y-3">
          {groups.map((group) => (
            <div key={group.relation} className="col-span-full grid grid-cols-subgrid">
              <h4 className="col-span-full mb-1 px-2 text-xs font-medium text-muted-foreground/70">
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
                  onChangeState={
                    canEdit ? (columnId) => setState(link.issue.id, columnId) : undefined
                  }
                  onRemove={
                    canEdit
                      ? () =>
                          unlinkIssues.mutate({
                            projectKey: project.project.ref,
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
        </IssueRefList>
      )}

      {dialogs}
    </IssueSection>
  );
}
