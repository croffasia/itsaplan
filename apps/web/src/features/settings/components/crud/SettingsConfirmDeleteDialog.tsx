import { type ReactNode } from 'react';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// Confirmation before an irreversible delete. The caller supplies the warning
// text (e.g. how many issues lose the label/type) and the delete request.
export default function SettingsConfirmDeleteDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title={title}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <div className="text-sm text-muted-foreground">{message}</div>
    </ConfirmDialog>
  );
}
