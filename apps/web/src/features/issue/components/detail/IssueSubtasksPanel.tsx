import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { IssueRelations } from '@/lib/api/endpoints/issues';
import { usePermissions } from '@/hooks/usePermissions';
import { canHaveSubtasks, subtaskProgress } from '@/utils/subtasks';
import IssuePickerDialog from '@/components/common/overlay/IssuePickerDialog';
import NewIssueModal from '../create/NewIssueModal';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { useSubtaskStateFilter } from '../../hooks/useSubtaskStateFilter';
import { useSetIssueParent } from '../../services/subtasks.service';
import { useSetRelatedIssueState } from '../../services/relatedIssues.service';
import IssueSection from './IssueSection';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSectionHeading from './IssueSectionHeading';
import IssueRefRow from './IssueRefRow';
import IssueRefList from './IssueRefList';
import IssueSubtasksAddMenu from './IssueSubtasksAddMenu';
import IssueSubtasksFilterChip from './IssueSubtasksFilterChip';
import IssueSubtasksFilterMenu from './IssueSubtasksFilterMenu';
import { useTranslations } from 'next-intl';

export type IssueSubtaskAdding = 'create' | 'attach';

// The issue's parent, and its subtasks with how many of them are done. An issue on
// the last level (MAX_SUBTASK_DEPTH) gets no Add menu. A new subtask opens the
// ordinary create modal with the parent's properties prefilled; an existing issue is
// attached through the search dialog. The section, and the Subtasks list inside it,
// stay off the page while there is nothing to list; the issue's add bar starts the
// first subtask.
export default function IssueSubtasksPanel({
  project,
  issue,
  adding = null,
  onAddingChange,
  readOnly,
  onOpenIssue,
}: {
  project: ProjectDetail;
  issue: IssueRelations;
  // Which dialog is open: the create modal or the search for an existing issue. Held
  // by the issue detail, whose add bar opens them too. A public share adds nothing.
  adding?: IssueSubtaskAdding | null;
  onAddingChange?: (adding: IssueSubtaskAdding | null) => void;
  readOnly?: boolean;
  // Where a public share opens the parent or a subtask, which has no page of its
  // own to link to.
  onOpenIssue?: (id: number) => void;
}) {
  const tCommon = useTranslations('common');
  const t = useTranslations('issue.subtasks');
  const { can } = usePermissions();
  const canEdit = !readOnly && can('work_items', 'edit');
  const canCreate = !readOnly && can('work_items', 'create');
  const { open, toggle } = usePersistedOpen('issue-subtasks-open');
  const filter = useSubtaskStateFilter(project, issue.subtasks);
  const setParent = useSetIssueParent();
  const setState = useSetRelatedIssueState(project.project.ref, issue.id);

  const parent = issue.parent;
  const canNest = canHaveSubtasks(issue);
  const showSubtasks = issue.subtasks.length > 0;
  const close = () => onAddingChange?.(null);

  const progress = subtaskProgress(issue.subtasks, new Map(project.columns.map((c) => [c.id, c])));
  const done = progress.total > 0 ? `${progress.done}/${progress.total}` : undefined;

  const detach = (subtaskId: number, parentId: number) =>
    setParent.mutate({
      projectKey: project.project.ref,
      issueId: subtaskId,
      parentId: null,
      previousParentId: parentId,
    });

  function subtasksBody() {
    if (filter.shownSubtasks.length === 0)
      return (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t('allHidden')}
        </p>
      );
    return (
      <IssueRefList>
        {filter.shownSubtasks.map((subtask) => (
          <IssueRefRow
            key={subtask.id}
            project={project}
            issue={subtask}
            scrollAnchorKey={`subtask:${subtask.id}`}
            removeLabel={t('detach', { subtask: subtask.identifier })}
            readOnly={readOnly}
            onOpen={onOpenIssue && (() => onOpenIssue(subtask.id))}
            onRemove={canEdit ? () => detach(subtask.id, issue.id) : undefined}
            onChangeState={canEdit ? (columnId) => setState(subtask.id, columnId) : undefined}
          />
        ))}
      </IssueRefList>
    );
  }

  const dialogs = (
    <>
      {adding === 'attach' && (
        <IssuePickerDialog
          projectKey={project.project.ref}
          title={t('addExisting')}
          prompt={t('searchPrompt')}
          // The API rejects a pick that would nest too deep with a message of its own.
          exclude={(hit) =>
            hit.id === issue.id ||
            hit.parentId === issue.id ||
            issue.ancestors.some((ancestor) => ancestor.id === hit.id)
          }
          onPick={(hit) => {
            setParent.mutate({
              projectKey: project.project.ref,
              issueId: hit.id,
              parentId: issue.id,
              previousParentId: hit.parentId,
            });
            close();
          }}
          onClose={close}
        />
      )}

      {adding === 'create' && (
        <NewIssueModal
          project={project}
          defaults={{
            parentId: issue.id,
            typeId: issue.typeId,
            initiativeId: issue.initiative?.id ?? null,
            assigneeUserId: issue.assigneeUserId,
            delegateUserId: null,
            priority: issue.priority,
          }}
          crumb={t('subtaskOf', { issue: issue.identifier })}
          onClose={close}
          onCreated={close}
        />
      )}
    </>
  );

  if (!parent && !showSubtasks) return dialogs;

  return (
    <IssueSection collapsed={!open}>
      {parent && (
        <>
          <IssueSectionHeading label={t('parent')} open={open} onToggle={toggle} />
          {open && (
            <IssueRefList>
              <IssueRefRow
                project={project}
                issue={parent}
                scrollAnchorKey={`parent:${parent.id}`}
                removeLabel={t('detachFromParent', { parent: parent.identifier })}
                readOnly={readOnly}
                onOpen={onOpenIssue && (() => onOpenIssue(parent.id))}
                onRemove={canEdit ? () => detach(issue.id, parent.id) : undefined}
                onChangeState={canEdit ? (columnId) => setState(parent.id, columnId) : undefined}
              />
            </IssueRefList>
          )}
        </>
      )}

      {showSubtasks && (
        <>
          <IssueSectionHeading
            label={t('title')}
            open={open}
            onToggle={toggle}
            tally={done}
            className={parent ? 'mt-4' : undefined}
            beside={open && <IssueSubtasksFilterChip filter={filter} />}
            actions={
              open && (
                <>
                  <IssueSubtasksFilterMenu filter={filter} />
                  {canNest && canEdit && (
                    <IssueSubtasksAddMenu
                      canCreate={canCreate}
                      onCreate={() => onAddingChange?.('create')}
                      onAttach={() => onAddingChange?.('attach')}
                      trigger={<IssueSectionAddButton label={tCommon('add')} />}
                    />
                  )}
                </>
              )
            }
          />

          {open && subtasksBody()}
        </>
      )}

      {dialogs}
    </IssueSection>
  );
}
