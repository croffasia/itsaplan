'use client';

import { useState } from 'react';
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
  const [disposition, setDisposition] = useState<SubtaskDisposition | null>(null);
  const deleting = action === 'delete';
  const noun = `issue${ids.length === 1 ? '' : 's'}`;

  return (
    <ConfirmDialog
      title={`${deleting ? 'Delete' : 'Archive'} ${noun}`}
      confirmLabel={`${deleting ? 'Delete' : 'Archive'} ${ids.length} ${noun}`}
      confirmDisabled={subtaskCount > 0 && !dispositionReady(disposition)}
      onConfirm={async () => {
        await onConfirm(disposition ?? undefined);
        onClose();
      }}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {deleting
          ? `Delete ${ids.length} selected ${noun}? This also removes comments, activity and attachments. This cannot be undone.`
          : `Archive ${ids.length} selected ${noun}? ${ids.length === 1 ? 'It leaves' : 'They leave'} the board and can be restored later.`}
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
