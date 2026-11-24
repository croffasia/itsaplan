import { useState } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, SubtaskDisposition } from '@/lib/api/endpoints/issues';
import { dispositionReady, removalCount, subtaskCount } from '@/utils/subtasks';
import { useArchiveIssue, useIssueSubtreeQuery } from '@/services/issues.service';
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
  const tr = useTranslations('workItems.removal');
  const archiveIssue = useArchiveIssue(project.project.ref);
  const subtasks = subtaskCount(project.issues, [issue.id]);
  const [disposition, setDisposition] = useState<SubtaskDisposition | null>(null);
  const subtree = useIssueSubtreeQuery(project.project.ref, [issue.id]).data;
  const active = (subtree ?? []).filter((subtask) => !subtask.archived);
  const archived = removalCount([issue.id], active, disposition);

  return (
    <ConfirmDialog
      title={t('archiveQuestion', { issue: issue.identifier })}
      confirmLabel={archived > 1 ? tr('archive.confirm', { count: archived }) : t('archiveTitle')}
      confirmDisabled={!dispositionReady(disposition)}
      wide="xl"
      onConfirm={async () => {
        await archiveIssue.mutateAsync({ id: issue.id, subtasks: disposition ?? undefined });
        onClose();
        onArchived?.();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">{t('archiveDescription')}</p>
      <SubtaskDisposalChoice
        projectKey={project.project.ref}
        action="archive"
        count={subtasks}
        removedIssueIds={[issue.id]}
        value={disposition}
        onChange={setDisposition}
      />
    </ConfirmDialog>
  );
}
