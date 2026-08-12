'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type SubtaskDisposition } from '@/lib/api';
import { dispositionReady } from '@/utils/subtasks';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SubtaskDisposalChoice from '@/features/issue/components/actions/SubtaskDisposalChoice';

// Confirms archiving or deleting the selected issues, asking what happens to their
// subtasks when the selection has any. Mounted only while the bar is confirming,
// so the choice belongs to this selection and not to the previous confirmation.
export function BulkRemovalDialog({
  projectKey,
  action,
  ids,
  subtaskCount,
  onConfirm,
  onClose,
}: {
  projectKey: string;
  action: 'delete' | 'archive';
  ids: number[];
  subtaskCount: number;
  onConfirm: (subtasks?: SubtaskDisposition) => Promise<unknown>;
  onClose: () => void;
}) {
  const t = useTranslations('workItems.removal');
  const [disposition, setDisposition] = useState<SubtaskDisposition | null>(null);

  return (
    <ConfirmDialog
      title={t(`${action}.title`, { count: ids.length })}
      confirmLabel={t(`${action}.confirm`, { count: ids.length })}
      confirmDisabled={subtaskCount > 0 && !dispositionReady(disposition)}
      onConfirm={async () => {
        await onConfirm(disposition ?? undefined);
        onClose();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {t(`${action}.description`, { count: ids.length })}
      </p>
      {subtaskCount > 0 && (
        <SubtaskDisposalChoice
          projectKey={projectKey}
          action={action}
          count={subtaskCount}
          removedIssueIds={ids}
          value={disposition}
          onChange={setDisposition}
        />
      )}
    </ConfirmDialog>
  );
}
