import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// Confirmation before an irreversible delete. The caller supplies the warning
// text (e.g. how many issues lose the label/type) and the delete request.
export default function SettingsConfirmDeleteDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('common');
  return (
    <ConfirmDialog
      title={title}
      confirmLabel={confirmLabel ?? t('delete')}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <div className="text-sm text-muted-foreground">{message}</div>
    </ConfirmDialog>
  );
}
