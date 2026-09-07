import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { useTranslations } from 'next-intl';

export default function DocumentDeleteDialog({
  onClose,
  onDelete,
}: {
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations('documents');

  return (
    <ConfirmDialog
      title={t('deleteTitle')}
      confirmLabel={t('delete')}
      onClose={onClose}
      onConfirm={onDelete}
    >
      <p className="text-sm text-muted-foreground">{t('deleteDescription')}</p>
    </ConfirmDialog>
  );
}
