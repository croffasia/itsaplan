import { useState } from 'react';
import { type Issue, type ProjectDetail, type SubtaskDisposition } from '@/lib/api';
import { dispositionReady, subtaskCount } from '@/utils/subtasks';
import { useArchiveIssue } from '@/services/issues.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SubtaskDisposalChoice from './SubtaskDisposalChoice';
import { useTranslations } from 'next-intl';

// Confirm and run an archive. Only mounted for an issue that has subtasks — one
// without them is archived straight from its menu, with nothing to ask.
export default function ArchiveIssueDialog({
  project,
  issue,
  onClose,
  onArchived,
}: {
  project: ProjectDetail;
  issue: Issue;
  onClose: () => void;
  onArchived?: () => void;
}) {
  const t = useTranslations('issue.actions');
  const archiveIssue = useArchiveIssue(project.project.key);
  const subtasks = subtaskCount(project.issues, [issue.id]);
  const [disposition, setDisposition] = useState<SubtaskDisposition | null>(null);

  return (
    <ConfirmDialog
      title={t('archiveTitle')}
      confirmLabel={t('archiveTitle')}
      confirmDisabled={!dispositionReady(disposition)}
      onConfirm={async () => {
        await archiveIssue.mutateAsync({ id: issue.id, subtasks: disposition ?? undefined });
        onClose();
        onArchived?.();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t('archiveDescription', { issue: issue.identifier })}
      </p>
      <SubtaskDisposalChoice
        projectKey={project.project.key}
        action="archive"
        count={subtasks}
        removedIssueIds={[issue.id]}
        value={disposition}
        onChange={setDisposition}
      />
    </ConfirmDialog>
  );
}
