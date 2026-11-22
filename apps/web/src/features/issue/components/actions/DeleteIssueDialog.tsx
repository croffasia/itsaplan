import { useState } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, SubtaskDisposition } from '@/lib/api/endpoints/issues';
import { dispositionReady, removalCount } from '@/utils/subtasks';
import { useDeleteIssue, useIssueQuery, useIssueSubtreeQuery } from '@/services/issues.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SubtaskDisposalChoice from './SubtaskDisposalChoice';
import { useTranslations } from 'next-intl';

// Confirm and run a issue delete. Owns the mutation; the caller owns whether the
// dialog is mounted and leaves the deleted issue via onDeleted. Shared by the
// issue detail Actions bar and the context menu.
export function DeleteIssueDialog({
  project,
  issue,
  onClose,
  onDeleted,
}: {
  project: ProjectDetail;
  issue: Issue;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations('issue.actions');
  const tr = useTranslations('workItems.removal');
  const deleteIssue = useDeleteIssue(project.project.ref);
  // The board carries only active issues, so an archived issue's subtasks are not
  // countable from it. The detail read carries them, archived ones included; it is
  // already cached on the issue page and fetched once when the dialog opens
  // elsewhere, which is what holds the confirmation until the count is known.
  const detail = useIssueQuery(issue.id);
  const subtasks = detail.data?.subtasks.length ?? 0;
  const [disposition, setDisposition] = useState<SubtaskDisposition | null>(null);
  const subtree = useIssueSubtreeQuery(project.project.ref, [issue.id], subtasks > 0).data;
  const removed = removalCount([issue.id], subtree ?? [], disposition);

  return (
    <ConfirmDialog
      title={t('deleteQuestion', { issue: issue.identifier })}
      confirmLabel={removed > 1 ? tr('delete.confirm', { count: removed }) : t('deleteTitle')}
      wide={subtasks > 0 && 'xl'}
      confirmDisabled={!detail.data || (subtasks > 0 && !dispositionReady(disposition))}
      onConfirm={async () => {
        await deleteIssue.mutateAsync({ id: issue.id, subtasks: disposition ?? undefined });
        onClose();
        onDeleted?.();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('deleteDescription')} {t('cannotBeUndone')}
      </p>
      {subtasks > 0 && (
        <SubtaskDisposalChoice
          projectKey={project.project.ref}
          action="delete"
          count={subtasks}
          removedIssueIds={[issue.id]}
          value={disposition}
          onChange={setDisposition}
        />
      )}
    </ConfirmDialog>
  );
}
