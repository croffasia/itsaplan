import { useState } from 'react';
import { Plus } from 'lucide-react';
import { type IssueRelations, type ProjectDetail } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { subtaskProgress } from '@/utils/subtasks';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import IssuePickerDialog from '@/components/common/overlay/IssuePickerDialog';
import NewIssueModal from '../create/NewIssueModal';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import { useSetIssueParent } from '../../services/subtasks.service';
import IssueSectionHeading from './IssueSectionHeading';
import IssueRefRow from './IssueRefRow';
import { useTranslations } from 'next-intl';

// The issue's place in the subtask hierarchy: the parent it hangs under, or the
// subtasks it has with how many of them are done. The two never show together —
// the hierarchy is one level deep, so a subtask has no subtasks of its own. A new
// subtask opens the ordinary create modal with the parent's properties prefilled;
// an existing issue is attached through the search dialog. On a public share the
// section lists the hierarchy and stays off the page when the issue has none.
export default function IssueSubtasksPanel({
  project,
  issue,
  readOnly,
  onOpenIssue,
}: {
  project: ProjectDetail;
  issue: IssueRelations;
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
  const [attaching, setAttaching] = useState(false);
  const [creating, setCreating] = useState(false);
  const { open, toggle } = usePersistedOpen('issue-subtasks-open');
  const setParent = useSetIssueParent();

  const parent = issue.parent;
  if (readOnly && !parent && issue.subtasks.length === 0) return null;

  const progress = subtaskProgress(issue.subtasks, new Map(project.columns.map((c) => [c.id, c])));
  const done = progress.total > 0 ? `${progress.done}/${progress.total}` : undefined;

  const detach = (subtaskId: number, parentId: number) =>
    setParent.mutate({
      projectKey: project.project.key,
      issueId: subtaskId,
      parentId: null,
      previousParentId: parentId,
    });

  function body() {
    if (parent)
      return (
        <IssueRefRow
          project={project}
          issue={parent}
          scrollAnchorKey={`parent:${parent.id}`}
          removeLabel={t('detachFromParent', { parent: parent.identifier })}
          readOnly={readOnly}
          onOpen={onOpenIssue && (() => onOpenIssue(parent.id))}
          onRemove={canEdit ? () => detach(issue.id, parent.id) : undefined}
        />
      );
    if (issue.subtasks.length === 0)
      return (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {canEdit ? t('emptyHint') : t('empty')}
        </p>
      );
    return issue.subtasks.map((subtask) => (
      <IssueRefRow
        key={subtask.id}
        project={project}
        issue={subtask}
        scrollAnchorKey={`subtask:${subtask.id}`}
        removeLabel={t('detach', { subtask: subtask.identifier })}
        readOnly={readOnly}
        onOpen={onOpenIssue && (() => onOpenIssue(subtask.id))}
        onRemove={canEdit ? () => detach(subtask.id, issue.id) : undefined}
      />
    ));
  }

  return (
    // Collapsed, the heading row is all there is, so the section pulls itself up
    // against the section below it.
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      {/* Fixed height: the Add button only renders while the section is open, and
          without it the row would shrink to the height of the heading text. */}
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading
          label={parent ? t('parent') : t('title')}
          open={open}
          onToggle={toggle}
          tally={done}
        />
        {open && !parent && canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <Plus className="size-4" />
                {tCommon('add')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canCreate && (
                <DropdownMenuItem onSelect={() => setCreating(true)}>
                  {t('newSubtask')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setAttaching(true)}>
                {t('existingIssue')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && body()}

      {attaching && (
        <IssuePickerDialog
          projectKey={project.project.key}
          title={t('addExisting')}
          prompt={t('searchPrompt')}
          // The hierarchy is one level deep, so an issue that already hangs under
          // a parent has to be detached there first.
          exclude={(hit) => hit.id === issue.id || hit.parentId !== null}
          onPick={(hit) => {
            setParent.mutate({
              projectKey: project.project.key,
              issueId: hit.id,
              parentId: issue.id,
            });
            setAttaching(false);
          }}
          onClose={() => setAttaching(false)}
        />
      )}

      {creating && (
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
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
        />
      )}
    </div>
  );
}
