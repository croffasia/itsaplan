import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { useTranslations } from 'next-intl';

export default function DocumentDeleteDialog({
  title,
  onClose,
  onDelete,
}: {
  title: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations('documents');

  return (
    <ConfirmDialog
      title={t('deletePageTitle')}
      confirmLabel={t('deletePermanently')}
      onClose={onClose}
      onConfirm={onDelete}
    >
      <p className="text-sm text-muted-foreground">
        {t('deletePageDescription', { title: title.trim() || t('untitled') })}
      </p>
    </ConfirmDialog>
  );
}
